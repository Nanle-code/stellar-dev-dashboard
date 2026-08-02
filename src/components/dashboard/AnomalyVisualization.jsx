import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { select } from 'd3-selection'
import { scaleLinear, scaleOrdinal, scaleSqrt } from 'd3-scale'
import { zoom, zoomIdentity } from 'd3-zoom'
import { schemeTableau10 } from 'd3-scale-chromatic'
import {
  AlertTriangle,
  Info,
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Crosshair,
  Filter,
} from 'lucide-react'

import { useStore } from '../../lib/store'
import Card from './Card'
import { StatCard } from './Card'
import { IsolationForest, extractFeatures } from '../../lib/transactionPatternAnalysis'
import { pca } from '../../lib/dimensionalityReduction'
import { kmeans } from '../../lib/anomalyClustering'

const COLORS = {
  cyan: '#00e5ff',
  blue: '#38bdf8',
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
  violet: '#8b5cf6',
}

function toNum(v, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function buildFallbackTransactions(count = 120) {
  const now = Date.now()
  const txs = []
  for (let i = 0; i < count; i++) {
    const isAnomaly = Math.random() < 0.12
    const fee = isAnomaly ? 10000 + Math.random() * 40000 : 100 + Math.random() * 400
    const opCount = isAnomaly ? Math.floor(Math.random() * 8) + 1 : Math.floor(Math.random() * 3) + 1
    const success = isAnomaly ? Math.random() < 0.4 : Math.random() < 0.98
    const hourOffset = isAnomaly ? Math.floor(Math.random() * 24) : 8 + Math.floor(Math.random() * 12)
    txs.push({
      id: `sample-${i}`,
      hash: `a${i.toString(16).padStart(63, '0')}`,
      created_at: new Date(now - (count - i) * 3600000 + hourOffset * 3600000).toISOString(),
      fee_charged: String(Math.round(fee)),
      operation_count: opCount,
      successful: success,
      memo: isAnomaly && Math.random() < 0.3 ? `ref-${i}` : undefined,
      source_account: `G${Array.from({ length: 55 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[Math.floor(Math.random() * 32)]).join('')}`,
    })
  }
  return txs
}

function buildFallbackOperations(txs) {
  const ops = []
  for (const tx of txs) {
    const opCount = toNum(tx.operation_count, 1)
    for (let j = 0; j < opCount; j++) {
      const types = ['payment', 'create_account', 'change_trust', 'manage_sell_offer', 'path_payment_strict_send', 'set_options']
      const isAnomalyOp = !tx.successful || toNum(tx.fee_charged) > 5000
      ops.push({
        id: `${tx.id}-op-${j}`,
        type: isAnomalyOp && Math.random() < 0.4 ? 'manage_sell_offer' : types[j % types.length],
        created_at: tx.created_at,
        amount: String(isAnomalyOp ? 10000 + Math.random() * 90000 : 10 + Math.random() * 500),
        asset_code: Math.random() < 0.5 ? 'XLM' : 'USDC',
        from: tx.source_account,
        to: `G${Array.from({ length: 55 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[Math.floor(Math.random() * 32)]).join('')}`,
        transaction_hash: tx.hash,
        source_account: tx.source_account,
      })
    }
  }
  return ops
}

export default function AnomalyVisualization() {
  const connectedAddress = useStore((s) => s.connectedAddress)
  const storeTxs = useStore((s) => s.transactions)
  const storeOps = useStore((s) => s.operations)

  const svgRef = useRef(null)
  const containerRef = useRef(null)

  const [selectedPoint, setSelectedPoint] = useState(null)
  const [anomalyThreshold, setAnomalyThreshold] = useState(0.5)
  const [colorMode, setColorMode] = useState('anomaly')
  const [showClusters, setShowClusters] = useState(true)
  const [pointSize, setPointSize] = useState(1)
  const [hoveredPoint, setHoveredPoint] = useState(null)
  const [transform, setTransform] = useState(zoomIdentity)
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 })

  const transactions = useMemo(() => {
    const source = storeTxs.length > 5 ? storeTxs : buildFallbackTransactions(120)
    return source.map((tx) => ({
      id: tx.id,
      hash: tx.hash,
      created_at: tx.created_at,
      fee_charged: toNum(tx.fee_charged, 0),
      operation_count: toNum(tx.operation_count, 1),
      successful: tx.successful !== false,
      memo: tx.memo,
      source_account: tx.source_account || '',
    }))
  }, [storeTxs])

  const operations = useMemo(() => {
    if (storeOps.length > 5) return storeOps
    return buildFallbackOperations(transactions)
  }, [storeOps, transactions])

  const { projected, scores, clusters, clusterAssignments, explainedVariance, featureImportance } = useMemo(() => {
    if (transactions.length < 3) {
      return { projected: [], scores: [], clusters: [], clusterAssignments: [], explainedVariance: [], featureImportance: [] }
    }

    const { features, transactionIds } = extractFeatures(transactions, operations)

    const forest = new IsolationForest(50, Math.min(128, features.length))
    forest.fit(features)

    const scores = features.map((f) => forest.score(f))

    const pcaResult = pca(features, 2)
    const projected = pcaResult.projected || []

    let clusters = []
    let clusterAssignments = []

    if (projected.length >= 4) {
      const k = Math.min(5, Math.max(2, Math.floor(projected.length / 10)))
      const clusterResult = kmeans(projected, k, { maxIter: 30 })
      clusterAssignments = clusterResult.assignments
      clusters = clusterResult.clusters
    }

    const explainedVariance = pcaResult.explainedVariance || []
    const featureImportance = (pcaResult.components || []).map((comp) =>
      comp.map((v) => Math.abs(v))
    )

    return { projected, scores, clusters, clusterAssignments, explainedVariance, featureImportance, transactionIds }
  }, [transactions, operations])

  const dataPoints = useMemo(() => {
    if (!projected.length) return []
    return projected.map((pos, i) => ({
      index: i,
      x: pos[0],
      y: pos[1],
      score: scores[i],
      cluster: clusterAssignments[i] ?? -1,
      tx: transactions[i],
    }))
  }, [projected, scores, clusterAssignments, transactions])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      setDimensions({ width: rect.width, height: Math.max(400, rect.height) })
    }
  }, [])

  useEffect(() => {
    if (!svgRef.current || !dataPoints.length) return

    const svg = select(svgRef.current)
    const { width, height } = dimensions
    const margin = { top: 20, right: 20, bottom: 40, left: 40 }
    const plotW = width - margin.left - margin.right
    const plotH = height - margin.top - margin.bottom

    const xExtent = [
      Math.min(...dataPoints.map((d) => d.x)),
      Math.max(...dataPoints.map((d) => d.x)),
    ]
    const yExtent = [
      Math.min(...dataPoints.map((d) => d.y)),
      Math.max(...dataPoints.map((d) => d.y)),
    ]
    const xPad = (xExtent[1] - xExtent[0]) * 0.1 || 1
    const yPad = (yExtent[1] - yExtent[0]) * 0.1 || 1

    const xScale = scaleLinear()
      .domain([xExtent[0] - xPad, xExtent[1] + xPad])
      .range([0, plotW])
    const yScale = scaleLinear()
      .domain([yExtent[0] - yPad, yExtent[1] + yPad])
      .range([plotH, 0])

    const colorScale = scaleLinear()
      .domain([0, 0.4, 0.8, 1])
      .range([COLORS.green, COLORS.blue, COLORS.amber, COLORS.red])

    const clusterColors = scaleOrdinal(schemeTableau10)

    const radiusScale = scaleSqrt().domain([0, 1]).range([4, 16])

    svg.selectAll('g.plot-area').remove()
    svg.selectAll('g.axes').remove()
    svg.selectAll('defs').remove()

    const defs = svg.append('defs')
    const filterDef = defs.append('filter').attr('id', 'glow')
    filterDef.append('feGaussianBlur').attr('stdDeviation', '2').attr('result', 'blur')
    const merge = filterDef.append('feMerge')
    merge.append('feMergeNode').attr('in', 'blur')
    merge.append('feMergeNode').attr('in', 'SourceGraphic')

    const clipPath = defs.append('clipPath').attr('id', 'plot-clip')
    clipPath.append('rect').attr('width', plotW).attr('height', plotH)

    const zoomGroup = svg.append('g').attr('class', 'plot-area')

    const plotGroup = zoomGroup.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    if (showClusters && clusters.length > 1) {
      const hullData = clusters.map((cluster, idx) => {
        const pts = cluster.map((i) => dataPoints[i]).filter(Boolean)
        if (pts.length < 3) return null
        const centroid = [
          pts.reduce((s, p) => s + p.x, 0) / pts.length,
          pts.reduce((s, p) => s + p.y, 0) / pts.length,
        ]
        return { centroid, points: pts, clusterIdx: idx }
      }).filter(Boolean)

      hullData.forEach((h) => {
        if (!h) return
        const hullColor = clusterColors(h.clusterIdx)
        const hullPts = h.points
          .map((p) => ({
            sx: xScale(p.x),
            sy: yScale(p.y),
          }))
          .sort((a, b) => Math.atan2(a.sy - yScale(h.centroid[1]), a.sx - xScale(h.centroid[0]))
            - Math.atan2(b.sy - yScale(h.centroid[1]), b.sx - xScale(h.centroid[0])))

        if (hullPts.length < 3) return

        let pathD = `M${hullPts[0].sx},${hullPts[0].sy}`
        for (let i = 1; i < hullPts.length; i++) {
          pathD += `L${hullPts[i].sx},${hullPts[i].sy}`
        }
        pathD += 'Z'

        plotGroup.append('path')
          .attr('d', pathD)
          .attr('fill', hullColor)
          .attr('fill-opacity', 0.08)
          .attr('stroke', hullColor)
          .attr('stroke-opacity', 0.25)
          .attr('stroke-width', 1)
          .attr('stroke-dasharray', '4,3')
      })
    }

    plotGroup.append('g')
      .selectAll('circle')
      .data(dataPoints)
      .join('circle')
      .attr('cx', (d) => xScale(d.x))
      .attr('cy', (d) => yScale(d.y))
      .attr('r', (d) => {
        const base = radiusScale(d.score) * pointSize
        return Math.max(2, Math.min(base, 20))
      })
      .attr('fill', (d) =>
        colorMode === 'cluster' && d.cluster >= 0
          ? clusterColors(d.cluster)
          : colorScale(d.score)
      )
      .attr('fill-opacity', (d) => (d.score >= anomalyThreshold ? 0.9 : 0.35))
      .attr('stroke', (d) => {
        if (d.score >= anomalyThreshold) return colorScale(d.score)
        return 'var(--border)'
      })
      .attr('stroke-width', (d) => (d.score >= anomalyThreshold ? 1.5 : 0.5))
      .attr('style', 'cursor: pointer; transition: r 150ms ease;')
      .attr('data-index', (d) => d.index)
      .on('mouseenter', function (event, d) {
        select(this).attr('stroke', '#fff').attr('stroke-width', 2.5).attr('filter', 'url(#glow)')
        setHoveredPoint(d)
      })
      .on('mouseleave', function () {
        select(this).attr('stroke', null).attr('stroke-width', null).attr('filter', null)
        setHoveredPoint(null)
      })
      .on('click', function (event, d) {
        setSelectedPoint(d)
      })

    const axisGroup = svg.append('g').attr('class', 'axes')

    axisGroup.append('g')
      .attr('transform', `translate(${margin.left},${margin.top + plotH})`)
      .call((g) => {
        const axis = g.append('g')
        axis.attr('color', 'var(--text-muted)')
        axis.attr('font-size', '9px')
        const ticks = xScale.ticks(6)
        axis.selectAll('line').remove()
        axis.selectAll('text').remove()
        ticks.forEach((t) => {
          axis.append('line')
            .attr('x1', xScale(t)).attr('x2', xScale(t))
            .attr('y1', 0).attr('y2', 5)
            .attr('stroke', 'var(--text-muted)').attr('stroke-opacity', 0.3)
          axis.append('text')
            .attr('x', xScale(t)).attr('y', 16)
            .attr('text-anchor', 'middle')
            .attr('fill', 'var(--text-muted)')
            .attr('font-size', '9px')
            .text(t.toFixed(1))
        })
      })

    axisGroup.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)
      .call((g) => {
        const axis = g.append('g')
        axis.attr('color', 'var(--text-muted)')
        axis.attr('font-size', '9px')
        const ticks = yScale.ticks(6)
        ticks.forEach((t) => {
          axis.append('line')
            .attr('x1', -5).attr('x2', 0)
            .attr('y1', yScale(t)).attr('y2', yScale(t))
            .attr('stroke', 'var(--text-muted)').attr('stroke-opacity', 0.3)
          axis.append('text')
            .attr('x', -8).attr('y', yScale(t) + 3)
            .attr('text-anchor', 'end')
            .attr('fill', 'var(--text-muted)')
            .attr('font-size', '9px')
            .text(t.toFixed(1))
        })
      })

    axisGroup.append('text')
      .attr('x', margin.left + plotW / 2)
      .attr('y', height - 4)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--text-muted)')
      .attr('font-size', '9px')
      .text('PC1')

    axisGroup.append('text')
      .attr('x', 8)
      .attr('y', margin.top + plotH / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--text-muted)')
      .attr('font-size', '9px')
      .attr('transform', `rotate(-90, 8, ${margin.top + plotH / 2})`)
      .text('PC2')

    const zoomBehavior = zoom()
      .scaleExtent([0.5, 20])
      .translateExtent([
        [-margin.left, -margin.top],
        [width + margin.right, height + margin.bottom],
      ])
      .on('zoom', (event) => {
        zoomGroup.attr('transform', event.transform.toString())
        setTransform(event.transform)
      })

    svg.call(zoomBehavior)

    svg.on('dblclick.zoom', null)

    return () => {
      svg.on('.zoom', null)
    }
  }, [dataPoints, dimensions, anomalyThreshold, colorMode, showClusters, pointSize, clusters])

  const anomalyPoints = useMemo(() =>
    dataPoints.filter((d) => d.score >= anomalyThreshold),
    [dataPoints, anomalyThreshold]
  )

  const handleReset = useCallback(() => {
    if (svgRef.current) {
      const svg = select(svgRef.current)
      svg.transition().duration(500).call(zoom().transform, zoomIdentity)
      setTransform(zoomIdentity)
    }
  }, [])

  const handleZoomIn = useCallback(() => {
    if (svgRef.current) {
      const svg = select(svgRef.current)
      svg.transition().duration(300).call(zoom().scaleBy, 1.5)
    }
  }, [])

  const handleZoomOut = useCallback(() => {
    if (svgRef.current) {
      const svg = select(svgRef.current)
      svg.transition().duration(300).call(zoom().scaleBy, 0.67)
    }
  }, [])

  const anomalyCount = anomalyPoints.length

  const sliderStyle = {
    width: '100%',
    height: '4px',
    borderRadius: '2px',
    background: `linear-gradient(to right, ${COLORS.green} 0%, ${COLORS.blue} 33%, ${COLORS.amber} 66%, ${COLORS.red} 100%)`,
    outline: 'none',
    WebkitAppearance: 'none',
    appearance: 'none',
    cursor: 'pointer',
  }

  const thumbStyle = {
    WebkitAppearance: 'none',
    appearance: 'none',
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    background: 'var(--text-primary)',
    border: '2px solid var(--cyan)',
    cursor: 'pointer',
    marginTop: '-5px',
  }

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700 }}>
        Anomaly Visualization
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px' }}>
        <StatCard
          label="Total Points"
          value={dataPoints.length}
          accent={COLORS.cyan}
        />
        <StatCard
          label="Anomalies Found"
          value={anomalyCount}
          sub={`${dataPoints.length > 0 ? ((anomalyCount / dataPoints.length) * 100).toFixed(1) : 0}% of total`}
          accent={COLORS.amber}
        />
        <StatCard
          label="Clusters"
          value={clusters.length || '—'}
          accent={COLORS.violet}
        />
        <StatCard
          label="Explained Var."
          value={explainedVariance.length > 0 ? `${(explainedVariance.slice(0, 2).reduce((s, v) => s + v, 0) * 100).toFixed(1)}%` : '—'}
          sub="PC1 + PC2"
          accent={COLORS.green}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Card title="Controls">
            <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  Anomaly Threshold
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', width: '24px' }}>0</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={anomalyThreshold}
                    onChange={(e) => setAnomalyThreshold(Number(e.target.value))}
                    style={sliderStyle}
                  />
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', width: '24px', textAlign: 'right' }}>1</span>
                </div>
                <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', textAlign: 'center', marginTop: '4px' }}>
                  {anomalyThreshold.toFixed(2)}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  Color Mode
                </label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => setColorMode('anomaly')}
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      fontSize: '10px',
                      background: colorMode === 'anomaly' ? 'var(--cyan-glow)' : 'var(--bg-elevated)',
                      border: `1px solid ${colorMode === 'anomaly' ? 'var(--cyan-dim)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-sm)',
                      color: colorMode === 'anomaly' ? 'var(--cyan)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    Anomaly
                  </button>
                  <button
                    onClick={() => setColorMode('cluster')}
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      fontSize: '10px',
                      background: colorMode === 'cluster' ? 'var(--cyan-glow)' : 'var(--bg-elevated)',
                      border: `1px solid ${colorMode === 'cluster' ? 'var(--cyan-dim)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-sm)',
                      color: colorMode === 'cluster' ? 'var(--cyan)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    Cluster
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  Point Size
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.25"
                  value={pointSize}
                  onChange={(e) => setPointSize(Number(e.target.value))}
                  style={sliderStyle}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="show-clusters"
                  checked={showClusters}
                  onChange={(e) => setShowClusters(e.target.checked)}
                  style={{ accentColor: 'var(--cyan)' }}
                />
                <label htmlFor="show-clusters" style={{ fontSize: '11px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  Show Cluster Regions
                </label>
              </div>
            </div>
          </Card>

          <Card title="Legend">
            <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>Anomaly Score</div>
              <div style={{ height: '8px', borderRadius: '4px', background: 'linear-gradient(to right, #22c55e, #38bdf8, #f59e0b, #ef4444)', width: '100%' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)' }}>
                <span>Normal</span>
                <span>Anomaly</span>
              </div>
              {colorMode === 'cluster' && clusters.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Clusters ({clusters.length})
                  </div>
                  {clusters.map((cl, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: schemeTableau10[idx % 10], display: 'inline-block' }} />
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                        Cluster {idx + 1} ({cl.length})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card title="Actions">
            <div style={{ padding: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                onClick={handleZoomIn}
                className="touch-target-sm"
                aria-label="Zoom in"
                style={{
                  width: '32px', height: '32px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                <ZoomIn size={14} />
              </button>
              <button
                onClick={handleZoomOut}
                className="touch-target-sm"
                aria-label="Zoom out"
                style={{
                  width: '32px', height: '32px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                <ZoomOut size={14} />
              </button>
              <button
                onClick={handleReset}
                className="touch-target-sm"
                aria-label="Reset view"
                title="Reset View"
                style={{
                  width: '32px', height: '32px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </Card>

          {hoveredPoint && (
            <Card title="Hovered Point">
              <div style={{ padding: '10px', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ color: 'var(--text-secondary)' }}>
                  Anomaly: <span style={{ color: hoveredPoint.score >= anomalyThreshold ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>
                    {(hoveredPoint.score * 100).toFixed(1)}%
                  </span>
                </div>
                <div style={{ color: 'var(--text-muted)' }}>
                  Cluster: {hoveredPoint.cluster >= 0 ? `#${hoveredPoint.cluster + 1}` : '—'}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '10px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Tx: {hoveredPoint.tx?.id || '—'}
                </div>
              </div>
            </Card>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Card
            title="Anomaly Map"
            subtitle={`${anomalyCount} anomaly points highlighted`}
            glow={anomalyCount > 0}
          >
            <div
              ref={containerRef}
              style={{
                width: '100%',
                height: '500px',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {dataPoints.length === 0 ? (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: '100%', color: 'var(--text-muted)', fontSize: '13px',
                }}>
                  <Info size={16} style={{ marginRight: '8px' }} />
                  Not enough data for anomaly visualization (minimum 3 transactions required)
                </div>
              ) : (
                <svg
                  ref={svgRef}
                  width={dimensions.width}
                  height={dimensions.height}
                  style={{ display: 'block' }}
                />
              )}
            </div>
          </Card>

          {selectedPoint && (
            <Card title="Anomaly Details" action={
              <button
                onClick={() => setSelectedPoint(null)}
                style={{
                  background: 'transparent', border: 'none', color: 'var(--text-muted)',
                  cursor: 'pointer', fontSize: '14px',
                }}
              >
                &times;
              </button>
            }>
              <div style={{ padding: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    Transaction Info
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Hash</span>
                    <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '10px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {selectedPoint.tx?.hash?.slice(0, 16) || '—'}...
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Status</span>
                    <span style={{ color: selectedPoint.tx?.successful ? 'var(--green)' : 'var(--red)' }}>
                      {selectedPoint.tx?.successful ? 'Success' : 'Failed'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Fee</span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {selectedPoint.tx?.fee_charged ? `${Number(selectedPoint.tx.fee_charged).toLocaleString()} stroops` : '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Operations</span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {selectedPoint.tx?.operation_count || '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Memo</span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {selectedPoint.tx?.memo ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    Anomaly Analysis
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Score</span>
                    <span style={{
                      fontWeight: 600,
                      color: selectedPoint.score >= 0.8 ? 'var(--red)' : selectedPoint.score >= 0.5 ? 'var(--amber)' : 'var(--green)',
                    }}>
                      {(selectedPoint.score * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Cluster</span>
                    <span style={{ color: 'var(--violet)' }}>#{selectedPoint.cluster >= 0 ? selectedPoint.cluster + 1 : '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>PC1</span>
                    <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {selectedPoint.x.toFixed(3)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>PC2</span>
                    <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {selectedPoint.y.toFixed(3)}
                    </span>
                  </div>
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Contributors
                    </div>
                    {['Amount', 'Time Diff', 'Counterparties', 'Fee', 'Op Count', 'Failed'].map((name, idx) => {
                      const imp = featureImportance[0]?.[idx]
                      if (imp === undefined) return null
                      return (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                          <div style={{
                            height: '4px',
                            borderRadius: '2px',
                            background: imp > 0.3 ? 'var(--red)' : imp > 0.15 ? 'var(--amber)' : 'var(--green)',
                            width: `${Math.max(4, imp * 60)}px`,
                            transition: 'width 300ms ease',
                          }} />
                          <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{name}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
