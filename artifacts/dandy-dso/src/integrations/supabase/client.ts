const API = "/api/dso";

type Filter = { field: string; op: string; value: any; negate?: boolean };
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
  let _count: string | null = null;
  let _head = false;

  const self = {
    select(columns = "*", opts?: { count?: string; head?: boolean }) {
      _method = "select";
      _columns = columns;
      if (opts?.count) _count = opts.count;
      if (opts?.head) _head = true;
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
    not(field: string, op: string, value: any) {
      _filters.push({ field, op, value, negate: true });
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
    then(resolve: (v: { data: any; error: any; count?: number | null }) => any, reject?: any) {
      return execute().then(resolve, reject);
    },
    catch(onRejected: any) {
      return execute().catch(onRejected);
    },
    finally(onFinally: any) {
      return execute().finally(onFinally);
    },
  };

  async function execute(): Promise<{ data: any; error: any; count?: number | null }> {
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
          count: _count,
          head: _head,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const errorMsg = json.error || `HTTP ${res.status}: Request failed`;
        console.warn(`[DSO API] ${_method} on ${table} failed:`, errorMsg);
        return { data: null, error: { message: errorMsg, status: res.status }, count: null };
      }
      return { data: json.data, error: null, count: json.count ?? null };
    } catch (e: any) {
      const errorMsg = e.message || "Network or parsing error";
      console.warn(`[DSO API] Exception in ${_method} on ${table}:`, errorMsg);
      return { data: null, error: { message: errorMsg }, count: null };
    }
  }

  return self;
}

const storageProxy = {
  from: (bucket: string) => ({
    upload: async (filePath: string, file: File) => {
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("bucket", bucket);
        form.append("path", filePath);
        const res = await fetch(`${API}/storage/upload`, { method: "POST", body: form });
        const json = await res.json();
        if (!res.ok) {
          console.warn(`[DSO Storage] upload to ${bucket}/${filePath} failed: HTTP ${res.status}`, json);
          return { data: null, error: json };
        }
        return { data: json, error: null };
      } catch (e: any) {
        console.warn(`[DSO Storage] upload exception:`, e.message);
        return { data: null, error: { message: e.message } };
      }
    },
    getPublicUrl: (filePath: string) => ({
      data: { publicUrl: `${API}/storage/file?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(filePath)}` },
    }),
    list: async (prefix?: string) => {
      try {
        const params = new URLSearchParams({ bucket, prefix: prefix || "" });
        const res = await fetch(`${API}/storage/list?${params}`);
        const json = await res.json();
        if (!res.ok) {
          console.warn(`[DSO Storage] list ${bucket}/${prefix || ""} failed: HTTP ${res.status}`, json);
          return { data: null, error: json };
        }
        return { data: json.files, error: null };
      } catch (e: any) {
        console.warn(`[DSO Storage] list exception:`, e.message);
        return { data: null, error: { message: e.message } };
      }
    },
    remove: async (paths: string[]) => {
      try {
        const res = await fetch(`${API}/storage/delete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bucket, paths }),
        });
        const json = await res.json();
        if (!res.ok) {
          console.warn(`[DSO Storage] remove from ${bucket} failed: HTTP ${res.status}`, json);
          return { data: null, error: json };
        }
        return { data: json, error: null };
      } catch (e: any) {
        console.warn(`[DSO Storage] remove exception:`, e.message);
        return { data: null, error: { message: e.message } };
      }
    },
  }),
};

const functionsProxy = {
  invoke: async (name: string, opts?: { body?: any }) => {
    try {
      const res = await fetch(`${API}/functions/${name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opts?.body || {}),
      });
      const data = await res.json();
      if (!res.ok) {
        console.warn(`[DSO Functions] invoke ${name} failed: HTTP ${res.status}`, data);
        return { data: null, error: data };
      }
      return { data, error: null };
    } catch (e: any) {
      console.warn(`[DSO Functions] invoke ${name} exception:`, e.message);
      return { data: null, error: { message: e.message } };
    }
  },
};

type RealtimeChannel = {
  on: (...args: any[]) => RealtimeChannel;
  subscribe: () => RealtimeChannel;
};

function makeNoopChannel(): RealtimeChannel {
  const ch: RealtimeChannel = {
    on: () => ch,
    subscribe: () => ch,
  };
  return ch;
}

export const supabase = {
  from: buildQueryBuilder,
  storage: storageProxy,
  functions: functionsProxy,
  channel: (_name: string) => makeNoopChannel(),
  removeChannel: (_ch: any) => {},
};
