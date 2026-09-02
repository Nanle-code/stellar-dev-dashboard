import React, { useEffect, useMemo, useRef, useState } from 'react'
import { extent, max } from 'd3-array'
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
} from 'd3-force-3d'
import { scaleBand, scaleLinear, scaleOrdinal, scaleSqrt, scaleTime } from 'd3-scale'
import { interpolateTurbo, schemeTableau10 } from 'd3-scale-chromatic'
import { select } from 'd3-selection'
import { curveMonotoneX, line, linkHorizontal } from 'd3-shape'
import { timeFormat } from 'd3-time-format'
import { zoom, zoomIdentity } from 'd3-zoom'
import { Download, FileJson, Focus, GitBranch, Layers, Route, Share2 } from 'lucide-react'
import { useResponsive } from '../../hooks/useResponsive'
import { useStore } from '../../lib/store'
import Card from '../dashboard/Card'

const COLORS = {
  cyan: '#00e5ff',
  blue: '#38bdf8',
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
  violet: '#8b5cf6',
}

const VIEW_OPTIONS = [
  { id: 'network', label: 'Network', icon: Share2 },
  { id: 'flows', label: 'Flows', icon: Route },
  { id: 'heatmap', label: 'Heatmap', icon: Layers },
  { id: 'timeline', label: 'Timeline', icon: GitBranch },
]

const METRIC_OPTIONS = [
  { id: 'count', label: 'Count' },
  { id: 'volume', label: 'Volume' },
  { id: 'fee', label: 'Fees' },
]

function shortAddress(value = '') {
  if (!value || value.length < 12) return value || 'Unknown'
  return `${value.slice(0, 5)}...${value.slice(-5)}`
}

function toNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function operationAmount(operation) {
  return toNumber(operation?.amount, 0) || toNumber(operation?.starting_balance, 0) || 1
}

function operationAsset(operation) {
  if (operation?.asset_code) return operation.asset_code
  if (operation?.selling_asset_code) return operation.selling_asset_code
  if (operation?.buying_asset_code) return operation.buying_asset_code
  return 'XLM'
}

function operationTime(operation, index) {
  const raw = operation?.created_at || operation?.ledger_close_time
  const date = raw ? new Date(raw) : new Date(Date.now() - (48 - index) * 60 * 60 * 1000)
  return Number.isNaN(date.getTime()) ? new Date(Date.now() - index * 60 * 60 * 1000) : date
}

function buildFallbackOperations() {
  const now = Date.now()
  const accounts = [
    'GA4C5M2M4D3YB6ATQ7L5XAPYQCH6JNB2SDEMO000001',
    'GB2Q9V6S4R7N5W8M1D3K2ALPHTEST0000000002',
    'GCBRIDGE5XRJ7WY9Q2L4ASSETFLOW0000000003',
    'GDDEX4Q6A2M8P9R5T3POOLWATCH000000000004',
    'GEANCHOR8P4Y2S6N1K9LIQUIDITY0000000005',
  ]
  const types = ['payment', 'path_payment_strict_send', 'create_account', 'change_trust', 'manage_sell_offer']

  return Array.from({ length: 42 }, (_, index) => ({
    id: `sample-${index}`,
    type: types[index % types.length],
    from: accounts[index % accounts.length],
    to: accounts[(index + 2) % accounts.length],
    source_account: accounts[(index + 1) % accounts.length],
    amount: String(((index % 8) + 1) * 14.5),
    asset_code: index % 3 === 0 ? 'USDC' : 'XLM',
    created_at: new Date(now - (42 - index) * 2 * 60 * 60 * 1000).toISOString(),
  }))
}

function operationEndpoints(operation, centralAddress) {
  const source = operation?.from || operation?.funder || operation?.source_account || centralAddress || 'Account'
  const target = operation?.to || operation?.into || operation?.account || operation?.buyer || centralAddress || 'Counterparty'
  return source === target ? [source, `${target}-related`] : [source, target]
}

function metricValue(item, metric) {
  if (metric === 'volume') return item.volume || item.value || 0
  if (metric === 'fee') return item.fee || 0
  return item.count || 0
}

function csvEscape(value) {
  const text = String(value ?? '')
  return text.includes(',') || text.includes('"') ? `"${text.replace(/"/g, '""')}"` : text
}

function downloadText(filename, content, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function useElementSize(ref, fallbackHeight = 360) {
  const [size, setSize] = useState({ width: 820, height: fallbackHeight })

  useEffect(() => {
    if (!ref.current) return undefined
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.max(320, entry.contentRect.width)
      setSize({ width, height: fallbackHeight })
    })
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [fallbackHeight, ref])

  return size
}

function useVisualizationData(metric, density) {
  const { accountData, connectedAddress, transactions, operations } = useStore()

  return useMemo(() => {
    const centralAddress = connectedAddress || accountData?.account_id || accountData?.id || 'Dashboard Account'
    const sourceOperations = operations?.length ? operations : buildFallbackOperations()
    const sourceTransactions = transactions?.length ? transactions : sourceOperations.map((operation, index) => ({
      id: `tx-${operation.id || index}`,
      created_at: operation.created_at,
      fee_charged: String((index + 1) * 100),
      successful: index % 7 !== 0,
    }))

    const limit = density === 'dense' ? 64 : density === 'focused' ? 28 : 44
    const slicedOps = sourceOperations.slice(0, limit)
    const nodeMap = new Map()
    const linkMap = new Map()
    const flowMap = new Map()
    const heatMap = new Map()
    const timelineMap = new Map()

    const touchNode = (id, type, amount, count = 1) => {
      if (!id) return
      const current = nodeMap.get(id) || { id, label: shortAddress(id), type, count: 0, volume: 0, fee: 0 }
      current.count += count
      current.volume += amount
      current.type = current.type === 'account' ? current.type : type
      nodeMap.set(id, current)
    }

    touchNode(centralAddress, 'central', 0, 2)

    slicedOps.forEach((operation, index) => {
      const [source, target] = operationEndpoints(operation, centralAddress)
      const amount = operationAmount(operation)
      const fee = toNumber(operation?.fee_charged, 0) / 10000000
      const type = operation?.type || 'operation'
      const asset = operationAsset(operation)
      const time = operationTime(operation, index)
      const dayKey = timeFormat('%Y-%m-%d')(time)
      const heatKey = `${time.getDay()}-${time.getHours()}`
      const linkKey = `${source}|${target}`
      const flowKey = `${type}|${asset}`

      touchNode(source, source === centralAddress ? 'central' : 'account', amount)
      touchNode(target, target === centralAddress ? 'central' : 'account', amount)

      const link = linkMap.get(linkKey) || { source, target, count: 0, volume: 0, fee: 0, type }
      link.count += 1
      link.volume += amount
      link.fee += fee
      link.type = type
      linkMap.set(linkKey, link)

      const flow = flowMap.get(flowKey) || { source: type, target: asset, count: 0, volume: 0, fee: 0 }
      flow.count += 1
      flow.volume += amount
      flow.fee += fee
      flowMap.set(flowKey, flow)

      const heat = heatMap.get(heatKey) || { day: time.getDay(), hour: time.getHours(), count: 0, volume: 0, fee: 0 }
      heat.count += 1
      heat.volume += amount
      heat.fee += fee
      heatMap.set(heatKey, heat)

      const point = timelineMap.get(dayKey) || { date: new Date(dayKey), count: 0, volume: 0, fee: 0, failures: 0 }
      point.count += 1
      point.volume += amount
      point.fee += fee
      timelineMap.set(dayKey, point)
    })

    sourceTransactions.forEach((transaction, index) => {
      const time = operationTime(transaction, index)
      const dayKey = timeFormat('%Y-%m-%d')(time)
      const fee = toNumber(transaction?.fee_charged, 0) / 10000000
      const point = timelineMap.get(dayKey) || { date: new Date(dayKey), count: 0, volume: 0, fee: 0, failures: 0 }
      point.count += 1
      point.fee += fee
      if (transaction?.successful === false) point.failures += 1
      timelineMap.set(dayKey, point)
    })

    const nodes = Array.from(nodeMap.values()).sort((a, b) => metricValue(b, metric) - metricValue(a, metric)).slice(0, limit)
    const nodeSet = new Set(nodes.map((node) => node.id))
    const links = Array.from(linkMap.values())
      .filter((link) => nodeSet.has(link.source) && nodeSet.has(link.target))
      .sort((a, b) => metricValue(b, metric) - metricValue(a, metric))
      .slice(0, limit)

    const flowLinks = Array.from(flowMap.values()).sort((a, b) => metricValue(b, metric) - metricValue(a, metric))
    const heatmap = Array.from({ length: 7 * 24 }, (_, index) => {
      const day = Math.floor(index / 24)
      const hour = index % 24
      return heatMap.get(`${day}-${hour}`) || { day, hour, count: 0, volume: 0, fee: 0 }
    })
    const timeline = Array.from(timelineMap.values()).sort((a, b) => a.date - b.date)

    return {
      centralAddress,
      nodes,
      links,
      flows: flowLinks,
      heatmap,
      timeline,
      hasLiveData: Boolean(operations?.length || transactions?.length),
    }
  }, [accountData, connectedAddress, density, metric, operations, transactions])
}

function ToolbarButton({ active, children, icon: Icon, onClick, title }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={title || (typeof children === 'string' ? children : undefined)}
      onClick={onClick}
      style={{
        alignItems: 'center',
        background: active ? 'var(--cyan-glow)' : 'var(--bg-elevated)',
        border: `1px solid ${active ? 'var(--cyan)' : 'var(--border)'}`,
        borderRadius: '7px',
        color: active ? 'var(--cyan)' : 'var(--text-secondary)',
        cursor: 'pointer',
        display: 'inline-flex',
        fontSize: '12px',
        gap: '7px',
        minHeight: '34px',
        padding: '7px 10px',
      }}
    >
      {Icon && <Icon size={15} aria-hidden="true" />}
      {children}
    </button>
  )
}

function NetworkTopology({ data, metric, colorMode, svgRef }) {
  const wrapperRef = useRef(null)
  const localSvgRef = useRef(null)
  const size = useElementSize(wrapperRef, 380)
  const [selectedNode, setSelectedNode] = useState(null)
  const [selectedLink, setSelectedLink] = useState(null)

  useEffect(() => {
    if (!localSvgRef.current) return undefined

    svgRef.current = localSvgRef.current
    const width = size.width
    const height = size.height
    const svg = select(localSvgRef.current)
    svg.selectAll('*').remove()
    svg.attr('viewBox', `0 0 ${width} ${height}`)

    const root = svg.append('g')
    const linksLayer = root.append('g')
    const nodesLayer = root.append('g')
    const labelsLayer = root.append('g')
    const metricMax = max([...data.nodes, ...data.links], (item) => metricValue(item, metric)) || 1
    const radius = scaleSqrt().domain([0, metricMax]).range([6, 24])
    const widthScale = scaleSqrt().domain([0, metricMax]).range([1.5, 8])
    const clusters = [...new Set(data.nodes.map((node) => node.type))]
    const clusterColor = scaleOrdinal(clusters, colorMode === 'clusters' ? schemeTableau10 : [COLORS.cyan, COLORS.green, COLORS.amber, COLORS.violet])

    const linkSelection = linksLayer
      .selectAll('line')
      .data(data.links)
      .join('line')
      .attr('stroke', COLORS.blue)
      .attr('stroke-opacity', 0.36)
      .attr('stroke-width', (link) => widthScale(metricValue(link, metric)))
      .on('mouseenter', (_, link) => setSelectedLink(link))
      .on('mouseleave', () => setSelectedLink(null))

    const nodeSelection = nodesLayer
      .selectAll('circle')
      .data(data.nodes)
      .join('circle')
      .attr('r', (node) => radius(metricValue(node, metric)))
      .attr('fill', (node) => (node.id === data.centralAddress ? COLORS.cyan : clusterColor(node.type)))
      .attr('stroke', '#ffffff')
      .attr('stroke-opacity', 0.26)
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('click', (_, node) => setSelectedNode(node))

    const labelSelection = labelsLayer
      .selectAll('text')
      .data(data.nodes)
      .join('text')
      .attr('font-size', 10)
      .attr('fill', 'var(--text-secondary)')
      .attr('text-anchor', 'middle')
      .attr('pointer-events', 'none')
      .text((node) => node.label)

    const zoomBehavior = zoom()
      .scaleExtent([0.45, 4])
      .on('zoom', (event) => {
        root.attr('transform', event.transform)
      })

    svg.call(zoomBehavior)

    const simulation = forceSimulation(data.nodes.map((node) => ({ ...node })), 2)
      .force('link', forceLink(data.links.map((link) => ({ ...link }))).id((node) => node.id).distance((link) => 84 + widthScale(metricValue(link, metric)) * 7))
      .force('charge', forceManyBody().strength(-180))
      .force('center', forceCenter(width / 2, height / 2))
      .force('collide', forceCollide((node) => radius(metricValue(node, metric)) + 10))
      .force('clusterX', forceX((node) => (node.type === 'central' ? width / 2 : width * (0.28 + (clusters.indexOf(node.type) % 3) * 0.22))).strength(0.04))
      .force('clusterY', forceY((node) => (node.type === 'central' ? height / 2 : height * (0.28 + (clusters.indexOf(node.type) % 2) * 0.3))).strength(0.035))
      .on('tick', () => {
        linkSelection
          .attr('x1', (link) => link.source.x)
          .attr('y1', (link) => link.source.y)
          .attr('x2', (link) => link.target.x)
          .attr('y2', (link) => link.target.y)
        nodeSelection.attr('cx', (node) => node.x).attr('cy', (node) => node.y)
        labelSelection.attr('x', (node) => node.x).attr('y', (node) => node.y + radius(metricValue(node, metric)) + 13)
      })

    localSvgRef.current.resetZoom = () => {
      svg.transition().duration(250).call(zoomBehavior.transform, zoomIdentity)
    }

    return () => simulation.stop()
  }, [colorMode, data, metric, size, svgRef])

  const selected = selectedNode || selectedLink

  return (
    <div ref={wrapperRef} style={{ minHeight: '380px', position: 'relative' }}>
      <svg ref={localSvgRef} role="img" aria-label="D3 force-directed transaction topology" style={{ display: 'block', height: '380px', width: '100%' }} />
      <button
        type="button"
        title="Reset zoom"
        onClick={() => localSvgRef.current?.resetZoom?.()}
        style={{
          alignItems: 'center',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: '7px',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          display: 'inline-flex',
          gap: '6px',
          padding: '7px 10px',
          position: 'absolute',
          right: 12,
          top: 12,
        }}
      >
        <Focus size={15} aria-hidden="true" />
        Reset
      </button>
      {selected && (
        <div style={{ bottom: 12, left: 12, position: 'absolute', right: 12 }}>
          <div style={{ background: 'rgba(15, 24, 32, 0.92)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '12px', padding: '10px 12px' }}>
            <strong style={{ color: 'var(--text-primary)' }}>{selected.label || `${shortAddress(selected.source?.id || selected.source)} -> ${shortAddress(selected.target?.id || selected.target)}`}</strong>
            <span style={{ marginLeft: '10px' }}>Count {selected.count || 0}</span>
            <span style={{ marginLeft: '10px' }}>Volume {(selected.volume || 0).toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function FlowDiagram({ data, metric, svgRef }) {
  const wrapperRef = useRef(null)
  const size = useElementSize(wrapperRef, 340)
  const width = size.width
  const height = size.height
  const margin = { top: 22, right: 124, bottom: 22, left: 144 }
  const flows = data.flows.slice(0, 14)
  const sourceNames = [...new Set(flows.map((flow) => flow.source))]
  const targetNames = [...new Set(flows.map((flow) => flow.target))]
  const sourceScale = scaleBand().domain(sourceNames).range([margin.top, height - margin.bottom]).padding(0.32)
  const targetScale = scaleBand().domain(targetNames).range([margin.top, height - margin.bottom]).padding(0.32)
  const valueMax = max(flows, (flow) => metricValue(flow, metric)) || 1
  const strokeScale = scaleLinear().domain([0, valueMax]).range([3, 22])
  const colorScale = scaleOrdinal(sourceNames, schemeTableau10)
  const pathFor = linkHorizontal()
    .x((point) => point[0])
    .y((point) => point[1])

  useEffect(() => {
    svgRef.current = wrapperRef.current?.querySelector('svg') || null
  }, [svgRef])

  return (
    <div ref={wrapperRef}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="D3 Sankey-style transaction flow diagram" style={{ display: 'block', height: '340px', width: '100%' }}>
        <g>
          {flows.map((flow) => {
            const sourceY = sourceScale(flow.source) + sourceScale.bandwidth() / 2
            const targetY = targetScale(flow.target) + targetScale.bandwidth() / 2
            const path = pathFor({ source: [margin.left, sourceY], target: [width - margin.right, targetY] })
            return (
              <path
                key={`${flow.source}-${flow.target}`}
                d={path}
                fill="none"
                stroke={colorScale(flow.source)}
                strokeLinecap="round"
                strokeOpacity={0.38}
                strokeWidth={strokeScale(metricValue(flow, metric))}
              >
                <title>{`${flow.source} to ${flow.target}: ${metricValue(flow, metric).toLocaleString()}`}</title>
              </path>
            )
          })}
          {sourceNames.map((name) => (
            <g key={name} transform={`translate(${margin.left - 12}, ${sourceScale(name)})`}>
              <rect x="-8" y="0" width="10" height={Math.max(18, sourceScale.bandwidth())} rx="3" fill={colorScale(name)} />
              <text x="-14" y={sourceScale.bandwidth() / 2 + 4} textAnchor="end" fill="var(--text-secondary)" fontSize="11">{name.replace(/_/g, ' ')}</text>
            </g>
          ))}
          {targetNames.map((name) => (
            <g key={name} transform={`translate(${width - margin.right + 12}, ${targetScale(name)})`}>
              <rect x="0" y="0" width="10" height={Math.max(18, targetScale.bandwidth())} rx="3" fill={COLORS.green} opacity="0.78" />
              <text x="18" y={targetScale.bandwidth() / 2 + 4} fill="var(--text-secondary)" fontSize="11">{name}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  )
}

function Heatmap({ data, metric, svgRef }) {
  const wrapperRef = useRef(null)
  const size = useElementSize(wrapperRef, 306)
  const width = size.width
  const height = size.height
  const margin = { top: 22, right: 16, bottom: 34, left: 54 }
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const hours = Array.from({ length: 24 }, (_, hour) => hour)
  const x = scaleBand().domain(hours).range([margin.left, width - margin.right]).padding(0.08)
  const y = scaleBand().domain(days).range([margin.top, height - margin.bottom]).padding(0.1)
  const valueMax = max(data.heatmap, (cell) => metricValue(cell, metric)) || 1
  const color = scaleLinear().domain([0, valueMax]).range([0.08, 1])

  useEffect(() => {
    svgRef.current = wrapperRef.current?.querySelector('svg') || null
  }, [svgRef])

  return (
    <div ref={wrapperRef}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="D3 activity heatmap by weekday and hour" style={{ display: 'block', height: '306px', width: '100%' }}>
        {data.heatmap.map((cell) => (
          <rect
            key={`${cell.day}-${cell.hour}`}
            x={x(cell.hour)}
            y={y(days[cell.day])}
            width={x.bandwidth()}
            height={y.bandwidth()}
            rx="3"
            fill={interpolateTurbo(color(metricValue(cell, metric)) * 0.72)}
            opacity={metricValue(cell, metric) === 0 ? 0.16 : 0.88}
          >
            <title>{`${days[cell.day]} ${cell.hour}:00 - ${metricValue(cell, metric).toLocaleString()}`}</title>
          </rect>
        ))}
        {days.map((day) => (
          <text key={day} x={margin.left - 10} y={y(day) + y.bandwidth() / 2 + 4} fill="var(--text-muted)" fontSize="11" textAnchor="end">{day}</text>
        ))}
        {hours.filter((hour) => hour % 3 === 0).map((hour) => (
          <text key={hour} x={x(hour) + x.bandwidth() / 2} y={height - 12} fill="var(--text-muted)" fontSize="10" textAnchor="middle">{hour}</text>
        ))}
      </svg>
    </div>
  )
}

function TimelineChart({ data, metric, svgRef }) {
  const wrapperRef = useRef(null)
  const size = useElementSize(wrapperRef, 320)
  const width = size.width
  const height = size.height
  const margin = { top: 24, right: 20, bottom: 42, left: 52 }
  const series = data.timeline.length > 1 ? data.timeline : [
    { date: new Date(Date.now() - 86400000), count: 0, volume: 0, fee: 0, failures: 0 },
    { date: new Date(), count: 0, volume: 0, fee: 0, failures: 0 },
  ]
  const dateExtent = extent(series, (point) => point.date)
  const x = scaleTime().domain(dateExtent).range([margin.left, width - margin.right])
  const valueMax = max(series, (point) => metricValue(point, metric)) || 1
  const y = scaleLinear().domain([0, valueMax]).nice().range([height - margin.bottom, margin.top])
  const sparkLine = line()
    .x((point) => x(point.date))
    .y((point) => y(metricValue(point, metric)))
    .curve(curveMonotoneX)
  const formatDate = timeFormat('%b %d')

  useEffect(() => {
    svgRef.current = wrapperRef.current?.querySelector('svg') || null
  }, [svgRef])

  return (
    <div ref={wrapperRef}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="D3 timeline chart for transaction activity" style={{ display: 'block', height: '320px', width: '100%' }}>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const yPos = margin.top + (height - margin.top - margin.bottom) * ratio
          return <line key={ratio} x1={margin.left} x2={width - margin.right} y1={yPos} y2={yPos} stroke="var(--border)" strokeDasharray="3 4" />
        })}
        <path d={sparkLine(series)} fill="none" stroke={COLORS.cyan} strokeWidth="2.5" />
        {series.map((point) => (
          <g key={point.date.toISOString()}>
            <circle cx={x(point.date)} cy={y(metricValue(point, metric))} r="4" fill={point.failures > 0 ? COLORS.red : COLORS.cyan} />
            <title>{`${formatDate(point.date)} - ${metricValue(point, metric).toLocaleString()}`}</title>
          </g>
        ))}
        {series.filter((_, index) => index === 0 || index === series.length - 1 || index % Math.ceil(series.length / 4) === 0).map((point) => (
          <text key={`tick-${point.date.toISOString()}`} x={x(point.date)} y={height - 14} fill="var(--text-muted)" fontSize="11" textAnchor="middle">{formatDate(point.date)}</text>
        ))}
        <text x={margin.left} y={18} fill="var(--text-secondary)" fontSize="12">Timeline by {metric}</text>
      </svg>
    </div>
  )
}

export default function D3VisualizationSuite() {
  const { isMobile } = useResponsive()
  const [activeView, setActiveView] = useState('network')
  const [metric, setMetric] = useState('count')
  const [density, setDensity] = useState('balanced')
  const [colorMode, setColorMode] = useState('clusters')
  const svgRef = useRef(null)
  const data = useVisualizationData(metric, density)

  const summary = useMemo(() => {
    const totalFlow = data.flows.reduce((sum, flow) => sum + metricValue(flow, metric), 0)
    const activeHours = data.heatmap.filter((cell) => metricValue(cell, metric) > 0).length
    return [
      { label: 'Nodes', value: data.nodes.length },
      { label: 'Links', value: data.links.length },
      { label: 'Flow', value: totalFlow.toLocaleString(undefined, { maximumFractionDigits: 2 }) },
      { label: 'Active hours', value: activeHours },
    ]
  }, [data, metric])

  function exportJson() {
    downloadText('stellar-d3-visualization.json', JSON.stringify({ metric, density, colorMode, data }, null, 2), 'application/json')
  }

  function exportCsv() {
    const rows = [['source', 'target', 'count', 'volume', 'fee']]
    data.links.forEach((link) => rows.push([link.source, link.target, link.count, link.volume, link.fee]))
    downloadText('stellar-d3-links.csv', rows.map((row) => row.map(csvEscape).join(',')).join('\n'), 'text/csv')
  }

  function exportSvg() {
    if (!svgRef.current) return
    const serialized = new XMLSerializer().serializeToString(svgRef.current)
    downloadText('stellar-d3-visualization.svg', serialized, 'image/svg+xml')
  }

  return (
    <Card
      title="D3 Visualization Builder"
      subtitle="Force topology, transaction flows, heatmaps, timelines, custom configuration, and export"
      action={<span style={{ color: data.hasLiveData ? 'var(--color-success, #22c55e)' : 'var(--text-muted)', fontSize: '11px' }}>{data.hasLiveData ? 'Live data' : 'Sample data'}</span>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '18px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {VIEW_OPTIONS.map(({ id, label, icon }) => (
            <ToolbarButton key={id} active={activeView === id} icon={icon} onClick={() => setActiveView(id)}>
              {label}
            </ToolbarButton>
          ))}
        </div>

        <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))' }}>
          <label style={{ color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', fontSize: '12px', gap: '7px' }}>
            Metric
            <select value={metric} onChange={(event) => setMetric(event.target.value)} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--text-primary)', minHeight: '36px', padding: '7px 9px' }}>
              {METRIC_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <label style={{ color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', fontSize: '12px', gap: '7px' }}>
            Density
            <select value={density} onChange={(event) => setDensity(event.target.value)} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--text-primary)', minHeight: '36px', padding: '7px 9px' }}>
              <option value="focused">Focused</option>
              <option value="balanced">Balanced</option>
              <option value="dense">Dense</option>
            </select>
          </label>
          <label style={{ color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', fontSize: '12px', gap: '7px' }}>
            Color
            <select value={colorMode} onChange={(event) => setColorMode(event.target.value)} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '7px', color: 'var(--text-primary)', minHeight: '36px', padding: '7px 9px' }}>
              <option value="clusters">Clusters</option>
              <option value="risk">Activity</option>
            </select>
          </label>
        </div>

        <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))' }}>
          {summary.map((item) => (
            <div key={item.label} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '5px', textTransform: 'uppercase' }}>{item.label}</div>
              <div style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700 }}>{item.value}</div>
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
          {activeView === 'network' && <NetworkTopology data={data} metric={metric} colorMode={colorMode} svgRef={svgRef} />}
          {activeView === 'flows' && <FlowDiagram data={data} metric={metric} svgRef={svgRef} />}
          {activeView === 'heatmap' && <Heatmap data={data} metric={metric} svgRef={svgRef} />}
          {activeView === 'timeline' && <TimelineChart data={data} metric={metric} svgRef={svgRef} />}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <ToolbarButton icon={FileJson} onClick={exportJson}>Export JSON</ToolbarButton>
          <ToolbarButton icon={Download} onClick={exportCsv}>Export CSV</ToolbarButton>
          <ToolbarButton icon={Download} onClick={exportSvg}>Export SVG</ToolbarButton>
        </div>
      </div>
    </Card>
  )
}
