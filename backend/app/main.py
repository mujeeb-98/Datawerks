from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import pyspark
from pyspark.sql import SparkSession
import pyspark.sql.functions as F
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Spark Session
spark = SparkSession.builder \
    .appName("VisualSpark") \
    .config("spark.driver.host", "localhost") \
    .getOrCreate()

class Node(BaseModel):
    id: str
    type: str
    data: Dict[str, Any]

class Edge(BaseModel):
    id: str
    source: str
    target: str

class Pipeline(BaseModel):
    nodes: List[Node]
    edges: List[Edge]

@app.get("/")
def read_root():
    return {"message": "Visual Spark Backend Running"}

@app.post("/run")
async def run_pipeline(pipeline: Pipeline):
    try:
        # Build adjacency list and in-degree map
        adj = {node.id: [] for node in pipeline.nodes}
        in_degree = {node.id: 0 for node in pipeline.nodes}
        for edge in pipeline.edges:
            adj[edge.source].append(edge.target)
            in_degree[edge.target] += 1

        # Map of node id to its output DataFrame
        outputs = {}
        # Final result to return (e.g. from display nodes)
        final_results = {}

        queue = [node.id for node in pipeline.nodes if in_degree[node.id] == 0]
        node_map = {node.id: node for node in pipeline.nodes}

        executed_nodes = []

        while queue:
            queue.sort()
            curr_id = queue.pop(0)
            node = node_map[curr_id]

            # Find all parent nodes that have outputs
            parents = [e.source for e in pipeline.edges if e.target == curr_id]
            parent_outputs = [outputs[p] for p in parents if p in outputs]

            # --- Sources ---
            if node.type == 'csv_reader':
                path = node.data.get('path', 'data.csv')
                outputs[curr_id] = spark.read.csv(path, header=True, inferSchema=True)

            elif node.type == 'json_reader':
                path = node.data.get('path')
                outputs[curr_id] = spark.read.json(path)

            elif node.type == 'parquet_reader':
                path = node.data.get('path')
                outputs[curr_id] = spark.read.parquet(path)

            elif node.type == 'jdbc_reader':
                url = node.data.get('url')
                table = node.data.get('table')
                user = node.data.get('user')
                password = node.data.get('password')
                outputs[curr_id] = spark.read.format("jdbc") \
                    .option("url", url) \
                    .option("dbtable", table) \
                    .option("user", user) \
                    .option("password", password) \
                    .load()

            # --- Transformations ---
            elif node.type == 'filter':
                condition = node.data.get('condition')
                if not parent_outputs: raise HTTPException(status_code=400, detail=f"No input for {curr_id}")
                outputs[curr_id] = parent_outputs[0].filter(condition) if condition else parent_outputs[0]

            elif node.type == 'select':
                columns = node.data.get('columns', [])
                if not parent_outputs: raise HTTPException(status_code=400, detail=f"No input for {curr_id}")
                outputs[curr_id] = parent_outputs[0].select(*columns) if columns else parent_outputs[0]

            elif node.type == 'join':
                join_type = node.data.get('join_type', 'inner')
                on_col = node.data.get('on')
                if len(parent_outputs) < 2:
                    raise HTTPException(status_code=400, detail=f"Join node {curr_id} requires 2 inputs")
                outputs[curr_id] = parent_outputs[0].join(parent_outputs[1], on=on_col, how=join_type)

            elif node.type == 'aggregate':
                group_by = node.data.get('group_by', [])
                aggs = node.data.get('aggregations', []) # list of {col: col_name, func: 'sum'|'avg'|'count'}
                if not parent_outputs: raise HTTPException(status_code=400, detail=f"No input for {curr_id}")

                df = parent_outputs[0]
                if group_by:
                    df = df.groupBy(*group_by)

                agg_exprs = []
                for a in aggs:
                    func = getattr(F, a['func'])
                    agg_exprs.append(func(a['col']).alias(a.get('alias', f"{a['func']}({a['col']})")))

                outputs[curr_id] = df.agg(*agg_exprs) if agg_exprs else parent_outputs[0]

            elif node.type == 'union':
                if len(parent_outputs) < 2:
                    raise HTTPException(status_code=400, detail=f"Union node {curr_id} requires at least 2 inputs")
                df = parent_outputs[0]
                for other in parent_outputs[1:]:
                    df = df.union(other)
                outputs[curr_id] = df

            elif node.type == 'sort':
                columns = node.data.get('columns', [])
                ascending = node.data.get('ascending', True)
                if not parent_outputs: raise HTTPException(status_code=400, detail=f"No input for {curr_id}")
                outputs[curr_id] = parent_outputs[0].orderBy(*columns, ascending=ascending)

            # --- Sinks ---
            elif node.type == 'csv_writer':
                path = node.data.get('path')
                if not parent_outputs: raise HTTPException(status_code=400, detail=f"No input for {curr_id}")
                parent_outputs[0].write.mode("overwrite").csv(path, header=True)
                outputs[curr_id] = parent_outputs[0]

            elif node.type == 'display':
                if not parent_outputs:
                    raise HTTPException(status_code=400, detail=f"No input for display node {curr_id}")
                data = parent_outputs[0].limit(10).toPandas().to_dict(orient='records')
                final_results[curr_id] = data
                outputs[curr_id] = parent_outputs[0]

            executed_nodes.append(curr_id)
            for neighbor in adj[curr_id]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

        response = {
            "status": "success",
            "executed": executed_nodes,
            "results": final_results
        }
        if final_results:
            last_display_id = [n_id for n_id in executed_nodes if n_id in final_results][-1]
            response["data"] = final_results[last_display_id]

        return response
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
