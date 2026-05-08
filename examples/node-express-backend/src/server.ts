import express, { type Request, type Response } from 'express';

interface Invoice {
  invoice_id: string;
  wallet_address?: string;
  expected_amount?: number;
  token_mint?: string;
  status: 'pending' | 'paid';
  paid_tx_signature?: string;
  paid_at?: string;
  created_at: string;
}

interface EventRecord {
  event_id: string;
  tx_signature: string;
  invoice_id: string;
  amount: number;
  outcome: 'processed' | 'duplicate' | 'ignored';
  reason?: string;
  received_at: string;
}

const invoices = new Map<string, Invoice>();
const eventsBySignature = new Map<string, EventRecord>();
const events: EventRecord[] = [];

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', name: 'chaoslab-example-node-express-backend' });
});

app.post('/admin/reset', (_req, res) => {
  invoices.clear();
  eventsBySignature.clear();
  events.length = 0;
  res.json({ reset: true });
});

app.post('/invoices', (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Partial<Invoice>;
  const invoice_id = body.invoice_id;
  if (!invoice_id) {
    return res.status(400).json({ error: 'invoice_id is required' });
  }
  if (invoices.has(invoice_id)) {
    return res.status(409).json({ error: 'invoice already exists', invoice_id });
  }
  const invoice: Invoice = {
    invoice_id,
    wallet_address: body.wallet_address,
    expected_amount: body.expected_amount,
    token_mint: body.token_mint,
    status: 'pending',
    created_at: new Date().toISOString(),
  };
  invoices.set(invoice_id, invoice);
  res.status(201).json(invoice);
});

app.get('/invoices/:invoice_id', (req, res) => {
  const inv = invoices.get(req.params.invoice_id);
  if (!inv) return res.status(404).json({ error: 'not found' });
  res.json(inv);
});

interface IncomingEvent {
  event_id?: string;
  tx_signature?: string;
  slot?: number;
  event_type?: string;
  invoice_id?: string;
  wallet_address?: string;
  amount?: number;
  token_mint?: string;
  timestamp?: string;
}

app.post('/webhooks/solana', (req: Request, res: Response) => {
  const evt = (req.body ?? {}) as IncomingEvent;
  const tx_signature = evt.tx_signature;
  if (!tx_signature) {
    return res.status(400).json({ error: 'tx_signature is required' });
  }
  const now = new Date().toISOString();
  const event_id = evt.event_id ?? `auto_${Date.now()}_${events.length}`;
  const invoice_id = evt.invoice_id ?? '';
  const amount = typeof evt.amount === 'number' ? evt.amount : 0;

  if (eventsBySignature.has(tx_signature)) {
    const dupe: EventRecord = {
      event_id,
      tx_signature,
      invoice_id,
      amount,
      outcome: 'duplicate',
      reason: 'tx_signature already seen',
      received_at: now,
    };
    events.push(dupe);
    return res.status(200).json({
      processed: false,
      reason: 'duplicate',
      event_id: dupe.event_id,
    });
  }

  const invoice = invoice_id ? invoices.get(invoice_id) : undefined;
  if (!invoice) {
    const ignored: EventRecord = {
      event_id,
      tx_signature,
      invoice_id,
      amount,
      outcome: 'ignored',
      reason: 'unknown_invoice',
      received_at: now,
    };
    events.push(ignored);
    eventsBySignature.set(tx_signature, ignored);
    return res.status(200).json({
      processed: false,
      reason: 'unknown_invoice',
      event_id: ignored.event_id,
    });
  }

  const processed: EventRecord = {
    event_id,
    tx_signature,
    invoice_id,
    amount,
    outcome: 'processed',
    received_at: now,
  };
  events.push(processed);
  eventsBySignature.set(tx_signature, processed);
  invoice.status = 'paid';
  invoice.paid_tx_signature = tx_signature;
  invoice.paid_at = now;
  res.status(200).json({ processed: true, event_id: processed.event_id });
});

app.get('/events', (_req, res) => {
  res.json({ events, total: events.length });
});

app.get('/events/summary', (_req, res) => {
  let processed = 0;
  let duplicate = 0;
  let ignored = 0;
  for (const e of events) {
    if (e.outcome === 'processed') processed += 1;
    else if (e.outcome === 'duplicate') duplicate += 1;
    else ignored += 1;
  }
  res.json({
    total_events: events.length,
    processed_events: processed,
    duplicate_events: duplicate,
    ignored_events: ignored,
  });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`[chaoslab-example-node] listening on http://0.0.0.0:${port}`);
});
