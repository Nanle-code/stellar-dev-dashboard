import type { ComponentType } from 'react'
import { useTranslation } from '../../hooks/useTranslation'
import NetworkMetricsChart from '../charts/NetworkMetricsChart'
import AccountActivityChart from '../charts/AccountActivityChart'
import BalanceHistoryChart from '../charts/BalanceHistoryChart'
import AdvancedChartSuite from '../charts/AdvancedChartSuite'
import D3VisualizationSuite from '../charts/D3VisualizationSuite'
import ChartRecommenderPanel from '../charts/ChartRecommenderPanel'

const MOCK_RECOMMENDER_DATA = [
  { name: 'Jan', value: 400, transactions: 2400 },
  { name: 'Feb', value: -300, transactions: 1398 },
  { name: 'Mar', value: 200, transactions: 9800 },
  { name: 'Apr', value: 278, transactions: 3908 },
  { name: 'May', value: 189, transactions: 4800 },
  { name: 'Jun', value: 239, transactions: 3800 },
  { name: 'Jul', value: 349, transactions: 4300 },
]

const ChartsTab: ComponentType = () => {
  const { t } = useTranslation() as { t: (key: string) => string }

  return (
    <div
      className="animate-in"
      style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
    >
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '22px',
          fontWeight: 700,
        }}
      >
        {t('charts.title')}
      </div>
      <ChartRecommenderPanel
        data={MOCK_RECOMMENDER_DATA}
        title="AI-Powered Analytics visualizer"
        dataKeys={['value', 'transactions']}
      />
      <NetworkMetricsChart />
      <AccountActivityChart />
      <BalanceHistoryChart />
      <D3VisualizationSuite />
      <AdvancedChartSuite />
    </div>
  )
}

export default ChartsTab
