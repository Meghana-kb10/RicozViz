import type { DatasetQueryFilter } from '@repo/types';

export interface DatasetColumnSummary {
  name: string;
  type: string;
  sampleValues?: unknown[];
}

export interface PromptBuildResult {
  systemPrompt: string;
  userPrompt: string;
}

export function buildNlToChartPrompt(
  datasetName: string,
  columns: DatasetColumnSummary[],
  prompt: string,
  filters: DatasetQueryFilter[] = []
): PromptBuildResult {
  const columnLines = columns.map((col) => {
    const samples = (col.sampleValues ?? [])
      .filter((v) => v !== null && v !== undefined && v !== '')
      .slice(0, 3)
      .map((v) => (typeof v === 'string' ? `'${v}'` : String(v)));

    const sampleStr = samples.length > 0 ? ` (samples: [${samples.join(', ')}])` : '';
    return `  - "${col.name}" (${col.type})${sampleStr}`;
  });

  const filterContext =
    filters.length > 0
      ? `Active user filters to incorporate where relevant:\n` +
        filters.map((f) => `  - "${f.column}" ${f.operator} '${f.value}'`).join('\n')
      : '';

  const systemPrompt = `You are a high-performance analytics and visualization AI for RicozViz.
Your task is to translate an analytical question into an exact DuckDB SQL query and appropriate visualization specification.

TABLE CONTEXT:
The data is available in a table named "dataset_table".

COLUMNS IN "dataset_table":
${columnLines.join('\n')}

${filterContext ? `${filterContext}\n` : ''}
RULES:
1. Generate valid, clean DuckDB SQL that queries ONLY from "dataset_table".
2. Only write a single SELECT query. DO NOT include multiple statements, DO NOT use DDL (DROP, CREATE, ALTER) or DML (INSERT, UPDATE, DELETE).
3. Only reference existing column names listed in the schema above.
4. If aggregating, always use GROUP BY for non-aggregated columns.
5. Supported chart types: "BAR", "LINE", "AREA", "PIE", "DONUT", "SCATTER", "KPI", "TABLE".
   - Use "LINE" or "AREA" for time series and date trends.
   - Use "BAR" for comparisons across categories.
   - Use "PIE" or "DONUT" for proportions/shares with 7 or fewer categories.
   - Use "SCATTER" for correlations between two continuous numerical variables.
   - Use "KPI" for single-number summary aggregations.
6. xField: string name of the dimension, category, or date column (or null for single-value KPI).
7. yField: string name of the metric or aggregate column.
8. title: a clear, concise title for the chart.

OUTPUT FORMAT:
Respond with STRICT, RAW JSON ONLY. No markdown formatting, no \`\`\`json code blocks, no explanations.
Required JSON schema:
{
  "sql": "SELECT ... FROM dataset_table ...",
  "chartType": "BAR",
  "xField": "dimension_name",
  "yField": "measure_name",
  "title": "Title of Chart"
}`;

  const userPrompt = `Analytical question: "${prompt}"`;

  return { systemPrompt, userPrompt };
}
