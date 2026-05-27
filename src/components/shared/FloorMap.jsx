import { getLocationMap } from '../../lib/sinarmsEngine';
import { useSinarms } from '../../context/SinarmsContext';

function statusColor(zone) {
  if (zone === 'restricted') return '#dc2626';
  if (zone === 'emergency') return '#2563eb';
  if (zone === 'waiting') return '#f59e0b';
  return '#0f172a';
}

export default function FloorMap({
  locationId,
  mapOverride = null,
  highlightedNodeIds = [],
  currentNodeId = null,
  destinationNodeId = null,
  visitorMarkers = [],
  selectedNodeId = null,
  onNodeSelect,
  showLabels = true,
}) {
  const { state } = useSinarms();
  const map = mapOverride || getLocationMap(state, locationId);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-950/5 dark:border-slate-700 dark:bg-slate-900/60">
      <svg viewBox="0 0 100 100" className="aspect-[16/10] w-full">
        <defs>
          <pattern id="grid" width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M 8 0 L 0 0 0 8" fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="0.3" />
          </pattern>
        </defs>

        <rect x="0" y="0" width="100" height="100" fill="url(#grid)" />

        {map.floorplanImage ? (
          <image href={map.floorplanImage} x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid slice" opacity="0.18" />
        ) : null}

        <rect x="2" y="12" width="24" height="18" rx="4" fill="rgba(255,255,255,0.6)" />
        <rect x="62" y="18" width="20" height="18" rx="4" fill="rgba(255,255,255,0.55)" />
        <rect x="62" y="48" width="20" height="18" rx="4" fill="rgba(255,255,255,0.55)" />
        <rect x="62" y="70" width="22" height="18" rx="4" fill="rgba(255,255,255,0.55)" />
        <rect x="30" y="48" width="28" height="16" rx="5" fill="rgba(255,255,255,0.35)" />

        {map.edges.map((edge) => {
          const fromNode = map.nodes.find((node) => node.id === edge.from);
          const toNode = map.nodes.find((node) => node.id === edge.to);
          const isHighlighted = highlightedNodeIds.includes(edge.from) && highlightedNodeIds.includes(edge.to);

          if (!fromNode || !toNode) {
            return null;
          }

          return (
            <line
              key={edge.id}
              x1={fromNode.x}
              y1={fromNode.y}
              x2={toNode.x}
              y2={toNode.y}
              stroke={isHighlighted ? '#cd5c5c' : 'rgba(100,116,139,0.45)'}
              strokeWidth={isHighlighted ? 2.6 : 1.4}
              strokeDasharray={isHighlighted ? '0' : '2 2'}
              opacity={edge.isAccessible ? 1 : 0.55}
            />
          );
        })}

        {map.nodes.map((node) => {
          const isCurrent = node.id === currentNodeId;
          const isDestination = node.id === destinationNodeId;
          const isSelected = node.id === selectedNodeId;
          const inRoute = highlightedNodeIds.includes(node.id);

          return (
            <g
              key={node.id}
              onClick={() => onNodeSelect?.(node.id)}
              className={onNodeSelect ? 'cursor-pointer' : undefined}
            >
              {isCurrent ? <circle cx={node.x} cy={node.y} r="4.6" fill="rgba(59,130,246,0.18)" /> : null}
              {isDestination ? <circle cx={node.x} cy={node.y} r="4.8" fill="rgba(239,68,68,0.15)" /> : null}
              <circle
                cx={node.x}
                cy={node.y}
                r={isCurrent || isDestination || isSelected ? '2.8' : '2.2'}
                fill={isCurrent ? '#2563eb' : isDestination ? '#dc2626' : inRoute ? '#cd5c5c' : statusColor(node.zone)}
                stroke={isSelected ? '#f8fafc' : '#ffffff'}
                strokeWidth={isSelected ? '1.2' : '0.8'}
              />
              {showLabels ? (
                <text
                  x={node.x}
                  y={node.y - 4.2}
                  textAnchor="middle"
                  fontSize="3.1"
                  fill="#334155"
                  className="dark:fill-slate-200"
                  style={{ fontWeight: 700 }}
                >
                  {node.label}
                </text>
              ) : null}
            </g>
          );
        })}

        {visitorMarkers.map((marker) => (
          <g key={marker.id}>
            <circle cx={marker.x} cy={marker.y} r="4" fill={marker.color} opacity="0.16" />
            <circle cx={marker.x} cy={marker.y} r="2.4" fill={marker.color} stroke="#fff" strokeWidth="0.8" />
            <text x={marker.x} y={marker.y + 7} textAnchor="middle" fontSize="2.8" fill="#0f172a" style={{ fontWeight: 700 }}>
              {marker.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
