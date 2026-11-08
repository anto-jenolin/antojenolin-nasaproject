

export interface TableColumn<T> {
  header: string;
  accessor: keyof T & string;
}

export interface TableProps<T extends Record<string, any>> {
  data: T[];
  columns: TableColumn<T>[];
  emptyMessage?: string;
}

export default function Table<T extends Record<string, any>>(props: TableProps<T>) {
  const { data, columns, emptyMessage = 'No data available' } = props;
  if (!data || data.length === 0) {
    return <div className="empty-state">{emptyMessage}</div>;
  }
  return (
    <table className="custom-table">
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.accessor}>{col.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i}>
            {columns.map((col) => (
              <td key={col.accessor}>{String(row[col.accessor] ?? '')}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
