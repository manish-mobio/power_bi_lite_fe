/**
 * Power BI Lite - Chart Configuration Types
 * @typedef {'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX'} AggOp
 * @typedef {'bar' | 'line' | 'pie' | 'area' | 'stackedBar' | 'donut' | 'scatter' | 'table'} ChartType
 *
 * @typedef {Object} Measure
 * @property {string} field - The field to calculate (e.g., "price")
 * @property {AggOp} op - The math operation
 *
 * @typedef {Object} ChartConfig
 * @property {string} id - Unique chart identifier
 * @property {ChartType} type - Chart type
 * @property {string} collection - API collection/endpoint (e.g., "users")
 * @property {string} dimension - Field to group by (e.g., "gender")
 * @property {Measure} measure - Aggregation configuration
 * @property {number} [limit] - Optional result limit
 * @property {string[]} [selectedFields] - Optional columns to use (table) or restrict
 * @property {string} [sortBy] - 'dimension' | 'measure'
 * @property {string} [sortOrder] - 'asc' | 'desc'
 *
 * @typedef {Object} FieldSchema
 * @property {string} name - Field name
 * @property {'string' | 'number' | 'boolean'} type - Field type
 */

import {
    BarChartOutlined,
    LineChartOutlined,
    PieChartOutlined,
    DotChartOutlined,
    AreaChartOutlined,
    TableOutlined,
} from '@ant-design/icons';

export const AGG_OPS = ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX'];
export const CHART_TYPES = ['bar', 'line', 'pie', 'area', 'stackedBar', 'donut', 'scatter', 'table'];
export const SORT_ORDERS = ['asc', 'desc'];
export const SORT_BY_OPTIONS = ['dimension', 'measure'];

export const CHART_TYPE_ICONS = {
    bar: <BarChartOutlined />,
    line: <LineChartOutlined />,
    pie: <PieChartOutlined />,
    donut: <PieChartOutlined />,
    area: <AreaChartOutlined />,
    stackedBar: <BarChartOutlined />,
    scatter: <DotChartOutlined />,
    table: <TableOutlined />,
};

