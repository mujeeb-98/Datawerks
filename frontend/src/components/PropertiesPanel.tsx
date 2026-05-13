import React from 'react';

const PropertiesPanel = ({ selectedNode, onUpdate }: any) => {
  if (!selectedNode) return <div style={{ padding: '20px' }}>Select a node to edit properties</div>;

  const { type, data } = selectedNode;
  const config = data.config;

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    onUpdate(selectedNode.id, value, name);
  };

  const renderFields = () => {
    switch (type) {
      case 'csv_reader':
      case 'json_reader':
      case 'parquet_reader':
      case 'csv_writer':
        return (
          <div>
            <label>Path:</label>
            <input name="path" value={config.path || ''} onChange={handleChange} style={{ width: '100%' }} />
          </div>
        );
      case 'filter':
        return (
          <div>
            <label>Condition:</label>
            <input name="condition" value={config.condition || ''} onChange={handleChange} style={{ width: '100%' }} />
          </div>
        );
      case 'select':
        return (
          <div>
            <label>Columns (comma separated):</label>
            <input
              name="columns"
              value={Array.isArray(config.columns) ? config.columns.join(', ') : config.columns || ''}
              onChange={(e) => onUpdate(selectedNode.id, e.target.value.split(',').map((s: string) => s.trim()), 'columns')}
              style={{ width: '100%' }}
            />
          </div>
        );
      case 'join':
        return (
          <div>
            <label>On Column:</label>
            <input name="on" value={config.on || ''} onChange={handleChange} style={{ width: '100%' }} />
            <label>Join Type:</label>
            <select name="join_type" value={config.join_type || 'inner'} onChange={handleChange} style={{ width: '100%' }}>
                <option value="inner">Inner</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
                <option value="outer">Outer</option>
            </select>
          </div>
        );
      case 'aggregate':
        return (
          <div>
            <label>Group By (comma separated):</label>
            <input
              name="group_by"
              value={Array.isArray(config.group_by) ? config.group_by.join(', ') : config.group_by || ''}
              onChange={(e) => onUpdate(selectedNode.id, e.target.value.split(',').map((s: string) => s.trim()), 'group_by')}
              style={{ width: '100%' }}
            />
            <p style={{ fontSize: '10px', color: '#666' }}>Note: Aggregations currently use Sum by default in this MVP</p>
          </div>
        );
      default:
        return <div>No configuration for this node type</div>;
    }
  };

  return (
    <div style={{ padding: '20px', background: '#fff', borderLeft: '1px solid #ccc', height: '100%', width: '300px' }}>
      <h3>Properties: {type}</h3>
      {renderFields()}
    </div>
  );
};

export default PropertiesPanel;
