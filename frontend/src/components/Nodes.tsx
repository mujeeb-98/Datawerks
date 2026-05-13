import { Handle, Position } from 'reactflow';

const BaseNode = ({ label, color, children, type = 'default' }: any) => {
  return (
    <div style={{
      padding: '10px',
      borderRadius: '5px',
      background: color,
      border: `1px solid ${color}`,
      minWidth: '120px',
      boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
    }}>
      {type !== 'input' && <Handle type="target" position={Position.Top} />}
      <div style={{ fontWeight: 'bold', marginBottom: '5px', fontSize: '12px' }}>{label}</div>
      {children}
      {type !== 'output' && <Handle type="source" position={Position.Bottom} />}
    </div>
  );
};

export const SourceNode = ({ data }: any) => (
  <BaseNode label="Source" color="#e1f5fe" type="input">
    <div style={{ fontSize: '10px' }}>{data.config.path || 'No path'}</div>
  </BaseNode>
);

export const TransformationNode = ({ data, label, color }: any) => (
  <BaseNode label={label} color={color}>
    <div style={{ fontSize: '10px' }}>Transformation</div>
  </BaseNode>
);

export const SinkNode = ({ data, label, color }: any) => (
  <BaseNode label={label} color={color} type="output">
    <div style={{ fontSize: '10px' }}>Sink</div>
  </BaseNode>
);
