import type {
  HTMLAttributes,
  ReactNode,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from 'react'
import './components.css'

type CardProps = HTMLAttributes<HTMLElement> & {
  as?: 'article' | 'div' | 'section'
  title?: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
}

export function Card({ as: Element = 'section', title, subtitle, action, className = '', children, ...props }: CardProps) {
  return (
    <Element className={`ds-card ${className}`.trim()} {...props}>
      {(title || subtitle || action) && (
        <header className="ds-card__header">
          <div>
            {title && <h2 className="ds-card__title">{title}</h2>}
            {subtitle && <p className="ds-card__subtitle">{subtitle}</p>}
          </div>
          {action && <div className="ds-card__action">{action}</div>}
        </header>
      )}
      {children}
    </Element>
  )
}

type StackProps = HTMLAttributes<HTMLDivElement> & {
  direction?: 'row' | 'column'
  gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  align?: 'start' | 'center' | 'end' | 'stretch'
  justify?: 'start' | 'center' | 'between' | 'end'
  wrap?: boolean
}

export function Stack({
  direction = 'column', gap = 'md', align = 'stretch', justify = 'start', wrap = false,
  className = '', children, ...props
}: StackProps) {
  const classes = [
    'ds-stack', `ds-stack--${direction}`, `ds-stack--gap-${gap}`,
    `ds-stack--align-${align}`, `ds-stack--justify-${justify}`, wrap && 'ds-stack--wrap', className,
  ].filter(Boolean).join(' ')
  return <div className={classes} {...props}>{children}</div>
}

export function Skeleton({ shape = 'text', className = '', ...props }: HTMLAttributes<HTMLSpanElement> & {
  shape?: 'text' | 'heading' | 'panel' | 'circle'
}) {
  return <span className={`ds-skeleton ds-skeleton--${shape} ${className}`.trim()} aria-hidden="true" {...props} />
}

export function Badge({ tone = 'neutral', className = '', ...props }: HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger'
}) {
  return <span className={`ds-badge ds-badge--${tone} ${className}`.trim()} {...props} />
}

type TableProps = TableHTMLAttributes<HTMLTableElement> & { caption?: ReactNode }

export function Table({ caption, className = '', children, ...props }: TableProps) {
  return (
    <div className="ds-table-scroll">
      <table className={`ds-table ${className}`.trim()} {...props}>
        {caption && <caption className="ds-table__caption">{caption}</caption>}
        {children}
      </table>
    </div>
  )
}

export function TableHeader({ className = '', ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={`ds-table__header-cell ${className}`.trim()} scope="col" {...props} />
}

export function TableCell({ className = '', ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`ds-table__cell ${className}`.trim()} {...props} />
}

export function TableHead({ className = '', ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={`ds-table__head ${className}`.trim()} {...props} />
}

export function TableBody({ className = '', ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={`ds-table__body ${className}`.trim()} {...props} />
}

export function TableRow({ className = '', ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={`ds-table__row ${className}`.trim()} {...props} />
}