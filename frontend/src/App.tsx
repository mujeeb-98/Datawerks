import React, { useState, useCallback, useMemo } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  type Connection,
  type Edge,
  type Node,
  useNodesState,
  useEdgesState,
  Panel
} from 'reactflow';
import 'reactflow/dist/style.css';
import axios from 'axios';

import { SourceNode, TransformationNode, SinkNode } from './components/Nodes';
import PropertiesPanel from './components/PropertiesPanel';

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

const App: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const nodeTypes = useMemo(() => ({
    csv_reader: SourceNode,
    json_reader: SourceNode,
    parquet_reader: SourceNode,
    jdbc_reader: SourceNode,
    filter: (props: any) => <TransformationNode {...props} label="Filter" color="#fff9c4" />,
    select: (props: any) => <TransformationNode {...props} label="Select" color="#f3e5f5" />,
    join: (props: any) => <TransformationNode {...props} label="Join" color="#ffebee" />,
    aggregate: (props: any) => <TransformationNode {...props} label="Aggregate" color="#e8f5e9" />,
    union: (props: any) => <TransformationNode {...props} label="Union" color="#fce4ec" />,
    sort: (props: any) => <TransformationNode {...props} label="Sort" color="#e0f2f1" />,
    csv_writer: (props: any) => <SinkNode {...props} label="CSV Sink" color="#efebe9" />,
    display: (props: any) => <SinkNode {...props} label="Display" color="#f1f8e9" />,
  }), []);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = (_: any, node: Node) => {
    setSelectedNodeId(node.id);
  };

  const updateNodeData = (nodeId: string, value: any, key: string) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              config: {
                ...node.data.config,
                [key]: value,
              },
            },
          };
        }
        return node;
      })
    );
  };

  const runPipeline = async () => {
    setLoading(true);
    setResult(null);
    try {
      const backendNodes = nodes.map(n => ({
        id: n.id,
        type: n.type,
        data: n.data.config
      }));

      const backendEdges = edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target
      }));

      const response = await axios.post('http://localhost:8000/run', {
        nodes: backendNodes,
        edges: backendEdges
      });
      setResult(response.data);
    } catch (error: any) {
      console.error('Error running pipeline:', error);
      alert(`Error running pipeline: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const addNode = (type: string) => {
    const id = `${Date.now()}`;
    const newNode: Node = {
      id,
      type,
      data: {
        label: type,
        config: {},
      },
      position: { x: Math.random() * 400, y: Math.random() * 400 },
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '10px', background: '#2c3e50', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Visual Spark Enterprise</h2>
        <button onClick={runPipeline} disabled={loading} style={{ background: '#27ae60', color: 'white', padding: '8px 20px', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>
          {loading ? 'Running...' : 'Run Pipeline'}
        </button>
      </header>

      <div style={{ flex: 1, display: 'flex' }}>
        <aside style={{ width: '200px', background: '#ecf0f1', padding: '10px', overflowY: 'auto' }}>
          <h4>Sources</h4>
          <button onClick={() => addNode('csv_reader')} style={{ width: '100%', marginBottom: '5px' }}>CSV Source</button>
          <button onClick={() => addNode('json_reader')} style={{ width: '100%', marginBottom: '5px' }}>JSON Source</button>

          <h4>Transformations</h4>
          <button onClick={() => addNode('filter')} style={{ width: '100%', marginBottom: '5px' }}>Filter</button>
          <button onClick={() => addNode('select')} style={{ width: '100%', marginBottom: '5px' }}>Select</button>
          <button onClick={() => addNode('join')} style={{ width: '100%', marginBottom: '5px' }}>Join</button>
          <button onClick={() => addNode('aggregate')} style={{ width: '100%', marginBottom: '5px' }}>Aggregate</button>

          <h4>Sinks</h4>
          <button onClick={() => addNode('csv_writer')} style={{ width: '100%', marginBottom: '5px' }}>CSV Sink</button>
          <button onClick={() => addNode('display')} style={{ width: '100%', marginBottom: '5px' }}>Display</button>
        </aside>

        <main style={{ flex: 1, position: 'relative' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
        </main>

        <PropertiesPanel selectedNode={selectedNode} onUpdate={updateNodeData} />
      </div>

      {result && result.results && (
        <div style={{ height: '250px', overflow: 'auto', background: '#fff', borderTop: '2px solid #dee2e6', padding: '15px' }}>
          <h3>Execution Results</h3>
          {Object.entries(result.results).map(([nodeId, data]: [string, any]) => (
            <div key={nodeId}>
              <h4>Node: {nodeId}</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#eee' }}>
                    {data.length > 0 && Object.keys(data[0]).map(k => <th key={k} style={{ border: '1px solid #ccc', padding: '5px' }}>{k}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row: any, i: number) => (
                    <tr key={i}>
                      {Object.values(row).map((v: any, j: number) => <td key={j} style={{ border: '1px solid #ccc', padding: '5px' }}>{String(v)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default App;
