import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import { useStore } from '../../lib/store'
import { shortAddress, fetchOperations } from '../../lib/stellar'
import { useAddressLabels } from '../../hooks/useAddressLabels'
import { Search, X, ZoomIn, ZoomOut, Maximize2, Network } from 'lucide-react'
import { analyzeRelationships } from '../../lib/relationshipEngine'
import RelationshipPanel from './RelationshipPanel'

const COLOR_CENTRAL = '#06b6d4'
const COLOR_HIGH = '#ef4444'
const COLOR_MED = '#f59e0b'
const COLOR_LOW = '#6366f1'
const COLOR_MIN = '#14b8a6'
const BG_COLOR = '#0a0e17'

function colorForTxCount(count, maxCount) {
  const ratio = maxCount > 1 ? count / maxCount : 0
  if (ratio > 0.7) return COLOR_HIGH
  if (ratio > 0.4) return COLOR_MED
  if (ratio > 0.15) return COLOR_LOW
  return COLOR_MIN
}

function extractAddressPairs(operations, centralAddress) {
  const nodeMap = new Map()
  const edgeKey = new Map()

  const touchNode = (addr) => {
    if (!addr || typeof addr !== 'string') return
    if (!nodeMap.has(addr)) {
      nodeMap.set(addr, { id: addr, address: addr, txCount: 0, isCentral: addr === centralAddress })
    }
    nodeMap.get(addr).txCount++
  }

  const touchEdge = (source, target) => {
    if (!source || !target || source === target) return
    const key = source < target ? `${source}|${target}` : `${target}|${source}`
    if (!edgeKey.has(key)) {
      edgeKey.set(key, { source, target, txCount: 0, types: new Set() })
    }
    const edge = edgeKey.get(key)
    edge.txCount++
  }

  for (const op of operations) {
    touchNode(op.source_account)
    touchNode(op.from)
    touchNode(op.to)
    touchNode(op.account)
    touchNode(op.funder)
    touchNode(op.into)
    touchNode(op.seller)
    touchNode(op.buyer)

    if (op.from && op.to) touchEdge(op.from, op.to)
    if (op.source_account && (op.from || op.to)) {
      const other = op.from || op.to
      if (other) touchEdge(op.source_account, other)
    }
    if (op.account && (op.from || op.to)) {
      const other = op.from || op.to
      if (other && other !== op.account) touchEdge(op.account, other)
    }
    if (op.funder && op.into) touchEdge(op.funder, op.into)
  }

  return { nodeMap, edgeKey }
}

const SCORE_EDGE_COLORS = [
  { min: 0.8, color: '#ef4444', glow: '#ef444460' },
  { min: 0.6, color: '#f59e0b', glow: '#f59e0b40' },
  { min: 0.4, color: '#8b5cf6', glow: '#8b5cf630' },
  { min: 0.2, color: '#6366f1', glow: '#6366f120' },
  { min: 0, color: '#ffffff25', glow: '#ffffff10' },
]

function scoreEdgeColor(score) {
  for (const tier of SCORE_EDGE_COLORS) {
    if (score >= tier.min) return tier
  }
  return SCORE_EDGE_COLORS[SCORE_EDGE_COLORS.length - 1]
}

export default function TransactionGraph() {
  const fgRef = useRef(null)
  const containerRef = useRef(null)
  const [ForceGraph, setForceGraph] = useState(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [minTxCount, setMinTxCount] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [directOnly, setDirectOnly] = useState(false)
  const [hoveredNode, setHoveredNode] = useState(null)
  const [hoveredLink, setHoveredLink] = useState(null)
  const [loadingMore, setLoadingMore] = useState(new Set())
  const [loadedAddresses, setLoadedAddresses] = useState(new Set())
  const [extraOps, setExtraOps] = useState([])
  const [showRelationships, setShowRelationships] = useState(false)

  const connectedAddress = useStore((s) => s.connectedAddress)
  const network = useStore((s) => s.network)
  const operations = useStore((s) => s.operations)
  const { labelMap } = useAddressLabels()

  useEffect(() => {
    import('react-force-graph-2d').then((mod) => setForceGraph(() => mod.default))
  }, [])

  useEffect(() => {
    if (connectedAddress) {
      setLoadedAddresses(new Set([connectedAddress]))
    }
  }, [connectedAddress])

  useEffect(() => {
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          setDimensions({ width, height })
        }
      }
    })
    if (containerRef.current) obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  const { nodeMap: fullNodeMap, edgeKey: fullEdgeKey } = useMemo(() => {
    return extractAddressPairs([...operations, ...extraOps], connectedAddress)
  }, [operations, connectedAddress, extraOps])

  const allOperations = useMemo(() => {
    return [...operations, ...extraOps]
  }, [operations, extraOps])

  const relationshipReport = useMemo(() => {
    return analyzeRelationships(allOperations, connectedAddress)
  }, [allOperations, connectedAddress])

  const scoreLookup = useMemo(() => {
    const map = {}
    if (!relationshipReport) return map
    for (const rel of relationshipReport.relationships) {
      map[rel.key] = rel
    }
    return map
  }, [relationshipReport])

  const importanceLookup = useMemo(() => {
    const map = {}
    if (!relationshipReport) return map
    for (const node of relationshipReport.rankedNodes) {
      map[node.address] = node.importance
    }
    return map
  }, [relationshipReport])

  const filteredGraphData = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    let nodes = []
    let links = []

    for (const [, node] of fullNodeMap) {
      if (node.txCount < minTxCount) continue
      if (directOnly && !node.isCentral) {
        const hasDirect = Array.from(fullEdgeKey.values()).some(
          (e) => (e.source === node.address || e.target === node.address) &&
            (e.source === connectedAddress || e.target === connectedAddress)
        )
        if (!hasDirect) continue
      }
      if (q && !node.address.toLowerCase().includes(q) && !(labelMap[node.address]?.label || '').toLowerCase().includes(q)) continue
      nodes.push(node)
    }

    const nodeSet = new Set(nodes.map((n) => n.id))
    for (const edge of fullEdgeKey.values()) {
      if (nodeSet.has(edge.source) && nodeSet.has(edge.target)) {
        const relKey = edge.source < edge.target ? `${edge.source}|${edge.target}` : `${edge.target}|${edge.source}`
        const rel = scoreLookup[relKey]
        links.push({
          source: edge.source,
          target: edge.target,
          txCount: edge.txCount,
          types: Array.from(edge.types),
          score: rel ? rel.score : 0,
        })
      }
    }

    const maxCount = Math.max(...nodes.map((n) => n.txCount), 1)
    nodes = nodes.map((n) => ({
      ...n,
      val: Math.log(n.txCount + 1) * 4 + 2,
      color: n.isCentral ? COLOR_CENTRAL : colorForTxCount(n.txCount, maxCount),
      importance: importanceLookup[n.address] || 0,
      score: n.isCentral ? 1 : (() => {
        const rels = relationshipReport?.relationships.filter((r) => r.addressA === n.address || r.addressB === n.address) || []
        return rels.length > 0 ? rels.reduce((s, r) => s + r.score, 0) / rels.length : 0
      })(),
    }))

    return { nodes, links }
  }, [fullNodeMap, fullEdgeKey, minTxCount, searchQuery, directOnly, connectedAddress, labelMap, scoreLookup, importanceLookup, relationshipReport])

  const handleNodeClick = useCallback(async (node) => {
    if (node.isCentral) return
    if (loadedAddresses.has(node.address)) return
    if (loadingMore.has(node.address)) return

    setLoadingMore((prev) => new Set(prev).add(node.address))
    try {
      const { records } = await fetchOperations(node.address, network, 50)
      setExtraOps((prev) => [...prev, ...records])
      setLoadedAddresses((prev) => new Set(prev).add(node.address))
    } catch {
      //
    } finally {
      setLoadingMore((prev) => {
        const next = new Set(prev)
        next.delete(node.address)
        return next
      })
    }
  }, [loadedAddresses, loadingMore, network])

  const handleNodeHover = useCallback((node) => {
    setHoveredNode(node)
    setHoveredLink(null)
  }, [])

  const handleLinkHover = useCallback((link) => {
    setHoveredLink(link)
    setHoveredNode(null)
  }, [])

  const handleZoomIn = useCallback(() => {
    if (fgRef.current) {
      const cur = fgRef.current.zoom()
      fgRef.current.zoom(cur * 1.4, 400)
    }
  }, [])

  const handleZoomOut = useCallback(() => {
    if (fgRef.current) {
      const cur = fgRef.current.zoom()
      fgRef.current.zoom(cur / 1.4, 400)
    }
  }, [])

  const handleReset = useCallback(() => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(400, 40)
    }
  }, [])

  const handleSelectAddress = useCallback((address) => {
    setSearchQuery(address)
    setDirectOnly(false)
    setMinTxCount(1)
  }, [])

  const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
    const label = node.isCentral ? 'You' : shortAddress(node.id)
    const size = node.val || 4
    const importance = node.importance || 0

    if (importance > 0.3) {
      const glowSize = size + 3 + importance * 4
      const gradient = ctx.createRadialGradient(node.x, node.y, size * 0.5, node.x, node.y, glowSize)
      gradient.addColorStop(0, node.isCentral ? '#06b6d440' : '#8b5cf630')
      gradient.addColorStop(1, 'transparent')
      ctx.beginPath()
      ctx.arc(node.x, node.y, glowSize, 0, 2 * Math.PI)
      ctx.fillStyle = gradient
      ctx.fill()
    }

    ctx.beginPath()
    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI)
    ctx.fillStyle = node.color || COLOR_LOW
    ctx.fill()

    if (node.isCentral) {
      ctx.strokeStyle = '#06b6d480'
      ctx.lineWidth = 2
      ctx.stroke()
    } else if (importance > 0.5) {
      ctx.strokeStyle = '#8b5cf680'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    if (globalScale > 1.5) {
      const fontSize = Math.max(6, Math.min(10, 10 / globalScale))
      ctx.font = `${fontSize}px var(--font-mono), monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillStyle = '#ffffffcc'
      ctx.fillText(label, node.x, node.y - size - 2)

      if (importance > 0.4 && globalScale > 2) {
        const scoreFontSize = Math.max(5, Math.min(8, 8 / globalScale))
        ctx.font = `${scoreFontSize}px var(--font-mono), monospace`
        ctx.textBaseline = 'top'
        ctx.fillStyle = '#8b5cf6aa'
        ctx.fillText(`I:${(importance * 100).toFixed(0)}`, node.x, node.y + size + 2)
      }
    }
  }, [])

  const linkColor = useCallback((link) => {
    const c = scoreEdgeColor(link.score || 0)
    return c.color
  }, [])

  const linkWidth = useCallback((link) => {
    const base = Math.log(link.txCount + 1) * 0.8 + 0.3
    const scoreBoost = (link.score || 0) * 1.5
    return base + scoreBoost
  }, [])

  if (!connectedAddress) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
        Connect an address to view the transaction graph.
      </div>
    )
  }

  if (!ForceGraph) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '400px', background: BG_COLOR, borderRadius: '8px',
        color: 'var(--text-muted)', fontSize: '12px',
      }}>
        Loading graph...
      </div>
    )
  }

  const tooltipData = hoveredNode || hoveredLink

  return (
    <div style={{
      display: 'flex', height: '100%', background: BG_COLOR, borderRadius: '8px', overflow: 'hidden', position: 'relative',
    }}>
      {/* Main graph area */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        {/* Controls */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px',
          background: '#0d1520', borderBottom: '1px solid #1a2332', flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            Transaction Graph
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Min TX:</label>
            <input
              type="range"
              min={1}
              max={20}
              value={minTxCount}
              onChange={(e) => setMinTxCount(Number(e.target.value))}
              style={{ width: '60px', accentColor: '#06b6d4' }}
            />
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', minWidth: '16px' }}>{minTxCount}</span>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input
              type="checkbox"
              checked={directOnly}
              onChange={(e) => setDirectOnly(e.target.checked)}
              style={{ accentColor: '#06b6d4' }}
            />
            Direct
          </label>

          <div style={{ position: 'relative', flex: '0 1 160px', minWidth: '100px' }}>
            <Search size={11} style={{ position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search address..."
              style={{
                width: '100%',
                padding: '3px 6px 3px 22px',
                fontSize: '10px',
                background: '#1a2332',
                border: '1px solid #253040',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{
                position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)',
                border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px',
              }}>
                <X size={10} />
              </button>
            )}
          </div>

          <div style={{ flex: 1 }} />

          <button
            onClick={() => setShowRelationships((v) => !v)}
            title="Relationship analysis"
            style={{
              ...controlBtnStyle,
              background: showRelationships ? '#8b5cf630' : '#1a2332',
              borderColor: showRelationships ? '#8b5cf660' : '#253040',
              color: showRelationships ? '#8b5cf6' : 'var(--text-secondary)',
            }}
          >
            <Network size={13} />
          </button>

          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={handleZoomIn} title="Zoom in" style={controlBtnStyle}>
              <ZoomIn size={13} />
            </button>
            <button onClick={handleZoomOut} title="Zoom out" style={controlBtnStyle}>
              <ZoomOut size={13} />
            </button>
            <button onClick={handleReset} title="Fit to screen" style={controlBtnStyle}>
              <Maximize2 size={13} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {[
              { label: 'Central', color: COLOR_CENTRAL },
              { label: 'High', color: COLOR_HIGH },
              { label: 'Med', color: COLOR_MED },
              { label: 'Low', color: COLOR_LOW },
              { label: 'Min', color: COLOR_MIN },
            ].map((item) => (
              <span key={item.label} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '9px', color: 'var(--text-muted)' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: item.color, display: 'inline-block' }} />
                {item.label}
              </span>
            ))}
          </div>

          <span style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {filteredGraphData.nodes.length} nodes / {filteredGraphData.links.length} edges
          </span>
        </div>

        {/* Graph canvas */}
        <div ref={containerRef} style={{ flex: 1, position: 'relative' }}>
          <ForceGraph
            ref={fgRef}
            graphData={filteredGraphData}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor={BG_COLOR}
            nodeCanvasObject={nodeCanvasObject}
            linkColor={linkColor}
            linkWidth={linkWidth}
            linkDirectionalArrowLength={3}
            linkDirectionalArrowRelPos={1}
            linkDirectionalParticles={1}
            linkDirectionalParticleWidth={1}
            linkDirectionalParticleSpeed={0.005}
            linkDirectionalParticleColor={() => '#06b6d480'}
            onNodeClick={(node) => handleNodeClick(node)}
            onNodeHover={handleNodeHover}
            onLinkHover={handleLinkHover}
            onBackgroundClick={() => { setHoveredNode(null); setHoveredLink(null) }}
            minZoom={0.3}
            maxZoom={10}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
            cooldownTicks={100}
            nodeRelSize={4}
          />

          {/* Tooltip */}
          {tooltipData && (
            <TooltipOverlay
              data={tooltipData}
              labelMap={labelMap}
              loadedAddresses={loadedAddresses}
              loadingMore={loadingMore}
              scoreLookup={scoreLookup}
            />
          )}
        </div>
      </div>

      {/* Relationship panel */}
      {showRelationships && (
        <RelationshipPanel
          report={relationshipReport}
          connectedAddress={connectedAddress}
          loading={false}
          onSelectAddress={handleSelectAddress}
          onClose={() => setShowRelationships(false)}
        />
      )}
    </div>
  )
}

function TooltipOverlay({ data, labelMap, loadedAddresses, loadingMore }) {
  const isNode = 'address' in data
  const scoreColorFn = (score) => {
    for (const tier of SCORE_EDGE_COLORS) {
      if (score >= tier.min) return tier.color
    }
    return SCORE_EDGE_COLORS[SCORE_EDGE_COLORS.length - 1].color
  }

  return (
    <div style={{
      position: 'absolute',
      bottom: '12px',
      left: '12px',
      maxWidth: '300px',
      padding: '8px 10px',
      fontSize: '11px',
      background: '#0d1520ee',
      border: '1px solid #253040',
      borderRadius: '6px',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-mono)',
      pointerEvents: 'none',
      zIndex: 10,
      backdropFilter: 'blur(4px)',
    }}>
      {isNode ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: data.color || '#6366f1', display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontSize: '12px', fontWeight: 600 }}>
              {data.isCentral ? 'Your Address' : (labelMap[data.address]?.label || shortAddress(data.address))}
            </span>
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', wordBreak: 'break-all' }}>{data.address}</div>
          <div style={{ marginTop: '4px', fontSize: '10px', color: 'var(--text-secondary)' }}>
            <div>{data.txCount} transaction{data.txCount !== 1 ? 's' : ''}</div>
            {data.importance > 0 && (
              <div>Importance: <span style={{ color: '#8b5cf6' }}>{(data.importance * 100).toFixed(0)}</span></div>
            )}
            {data.score > 0 && (
              <div>Avg rel score: <span style={{ color: scoreColorFn(data.score) }}>{(data.score * 100).toFixed(0)}</span></div>
            )}
            {data.isCentral && <span style={{ color: '#06b6d4' }}>Central node</span>}
            {!data.isCentral && !loadedAddresses.has(data.address) && (
              <span style={{ color: '#f59e0b' }}>Click to explore</span>
            )}
            {loadingMore.has(data.address) && (
              <span style={{ color: '#f59e0b' }}>Loading...</span>
            )}
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: '10px', fontWeight: 600, marginBottom: '2px' }}>
            {data.txCount} transaction{data.txCount !== 1 ? 's' : ''}
            {data.score > 0 && (
              <span style={{ marginLeft: '6px', color: scoreColorFn(data.score), fontSize: '9px' }}>
                Score: {(data.score * 100).toFixed(0)}
              </span>
            )}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
            {shortAddress(data.source.id)} → {shortAddress(data.target.id)}
          </div>
          {data.types?.length > 0 && (
            <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {data.types.slice(0, 3).join(', ')}
            </div>
          )}
        </>
      )}
    </div>
  )
}

const controlBtnStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '24px',
  height: '24px',
  border: '1px solid #253040',
  borderRadius: '4px',
  background: '#1a2332',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  transition: 'var(--transition)',
}
