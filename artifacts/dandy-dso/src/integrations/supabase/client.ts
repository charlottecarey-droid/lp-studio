const API = "/api/dso";

type Filter = { field: string; op: string; value: any };
type OrderSpec = { column: string; ascending: boolean };
type RangeSpec = { from: number; to: number };

function buildQueryBuilder(table: string) {
  let _method: "select" | "insert" | "upsert" | "update" | "delete" = "select";
  let _data: any = null;
  let _filters: Filter[] = [];
  let _columns = "*";
  let _limit: number | null = null;
  let _single = false;
  let _order: OrderSpec | null = null;
  let _onConflict: string | null = null;
  let _range: RangeSpec | null = null;

  const self = {
    select(columns = "*") {
      _method = "select";
      _columns = columns;
      return self;
    },
    insert(data: any) {
      _method = "insert";
      _data = data;
      return self;
    },
    upsert(data: any, opts?: { onConflict?: string }) {
      _method = "upsert";
      _data = data;
      if (opts?.onConflict) _onConflict = opts.onConflict;
      return self;
    },
    update(data: any) {
      _method = "update";
      _data = data;
      return self;
    },
    delete() {
      _method = "delete";
      return self;
    },
    eq(field: string, value: any) {
      _filters.push({ field, op: "eq", value });
      return self;
    },
    neq(field: string, value: any) {
      _filters.push({ field, op: "neq", value });
      return self;
    },
    ilike(field: string, value: any) {
      _filters.push({ field, op: "ilike", value });
      return self;
    },
    is(field: string, value: null) {
      _filters.push({ field, op: "is", value });
      return self;
    },
    in(field: string, value: any[]) {
      _filters.push({ field, op: "in", value });
      return self;
    },
    gt(field: string, value: any) {
      _filters.push({ field, op: "gt", value });
      return self;
    },
    gte(field: string, value: any) {
      _filters.push({ field, op: "gte", value });
      return self;
    },
    lt(field: string, value: any) {
      _filters.push({ field, op: "lt", value });
      return self;
    },
    lte(field: string, value: any) {
      _filters.push({ field, op: "lte", value });
      return self;
    },
    limit(n: number) {
      _limit = n;
      return self;
    },
    range(from: number, to: number) {
      _range = { from, to };
      return self;
    },
    order(column: string, opts?: { ascending?: boolean }) {
      _order = { column, ascending: opts?.ascending ?? true };
      return self;
    },
    single() {
      _single = true;
      return self;
    },
    then(resolve: (v: { data: any; error: any }) => any, reject?: any) {
      return execute().then(resolve, reject);
    },
    catch(onRejected: any) {
      return execute().catch(onRejected);
    },
    finally(onFinally: any) {
      return execute().finally(onFinally);
    },
  };

  async function execute(): Promise<{ data: any; error: any }> {
    try {
      const res = await fetch(`${API}/db/${table}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: _method,
          data: _data,
          filters: _filters,
          columns: _columns,
          limit: _limit,
          single: _single,
          order: _order,
          onConflict: _onConflict,
          range: _range,
        }),
      });
      const json = await res.json();
      if (!res.ok) return { data: null, error: { message: json.error || "Request failed" } };
      return { data: json.data, error: null };
    } catch (e: any) {
      return { data: null, error: { message: e.message } };
    }
  }

  return self;
}

const storageProxy = {
  from: (bucket: string) => ({
    upload: async (path: string, file: File) => {
      const form = new FormData();
      form.append("file", file);
      form.append("bucket", bucket);
      form.append("path", path);
      const res = await fetch(`${API}/storage/upload`, { method: "POST", body: form });
      const json = await res.json();
      return res.ok ? { data: json, error: null } : { data: null, error: json };
    },
    getPublicUrl: (filePath: string) => ({
      data: { publicUrl: `${API}/storage/file?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(filePath)}` },
    }),
    list: async (prefix?: string) => {
      const params = new URLSearchParams({ bucket, prefix: prefix || "" });
      const res = await fetch(`${API}/storage/list?${params}`);
      const json = await res.json();
      return res.ok ? { data: json.files, error: null } : { data: null, error: json };
    },
    remove: async (paths: string[]) => {
      const res = await fetch(`${API}/storage/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucket, paths }),
      });
      const json = await res.json();
      return res.ok ? { data: json, error: null } : { data: null, error: json };
    },
  }),
};

const functionsProxy = {
  invoke: async (name: string, opts?: { body?: any }) => {
    const res = await fetch(`${API}/functions/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts?.body || {}),
    });
    const data = await res.json();
    if (!res.ok) return { data: null, error: data };
    return { data, error: null };
  },
};

export const supabase = {
  from: buildQueryBuilder,
  storage: storageProxy,
  functions: functionsProxy,
};
