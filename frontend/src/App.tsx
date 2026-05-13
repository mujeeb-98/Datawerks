import React, { useState, useCallback } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  Connection,
  Edge,
  Node,
  ReactFlowProvider,
  useNodesState,
  useEdgesState
} from 'reactflow';
import 'reactflow/dist/style.css';
import axios from 'axios';

const initialNodes: Node[] = [
  {
    id: '1',
    type: 'input',
    data: { label: 'CSV Source' },
    position: { x: 250, y: 5 },
  },
];

const initialEdges: Edge[] = [];

const nodeTypes = {
  // custom node types could go here
};

const App: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const runPipeline = async () => {
    setLoading(true);
    try {
      // Map ReactFlow nodes/edges to backend format
      const backendNodes = nodes.map(n => ({
        id: n.id,
        type: n.data.type || 'csv_reader', // default for MVP
        data: n.data.config || { path: 'sample.csv' }
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
    } catch (error) {
      console.error('Error running pipeline:', error);
      alert('Error running pipeline');
    } finally {
      setLoading(false);
    }
  };

  const addNode = (type: string) => {
    const id = `${nodes.length + 1}`;
    const newNode: Node = {
      id,
      type: type === 'CSV Source' ? 'input' : type === 'Display' ? 'output' : 'default',
      data: {
        label: type,
        type: type === 'CSV Source' ? 'csv_reader' : type === 'Filter' ? 'filter' : type === 'Select' ? 'select' : 'display',
        config: type === 'CSV Source' ? { path: 'data.csv' } : type === 'Filter' ? { condition: "age > 30" } : type === 'Select' ? { columns: ['name', 'age'] } : {}
      },
      position: { x: Math.random() * 400, y: Math.random() * 400 },
    };
    setNodes((nds) => nds.concat(newNode));
  };

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px', background: '#f0f0f0', display: 'flex', gap: '10px' }}>
        <button onClick={() => addNode('CSV Source')}>Add CSV Source</button>
        <button onClick={() => addNode('Filter')}>Add Filter</button>
        <button onClick={() => addNode('Select')}>Add Select</button>
        <button onClick={() => addNode('Display')}>Add Display</button>
        <button
          onClick={runPipeline}
          style={{ marginLeft: 'auto', background: '#4CAF50', color: 'white', border: 'none', padding: '5px 15px', borderRadius: '4px', cursor: 'pointer' }}
          disabled={loading}
        >
          {loading ? 'Running...' : 'Run Pipeline'}
        </button>
      </div>
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
      {result && (
        <div style={{ height: '200px', overflow: 'auto', background: 'white', borderTop: '1px solid #ccc', padding: '10px' }}>
          <h3>Results:</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default App;
