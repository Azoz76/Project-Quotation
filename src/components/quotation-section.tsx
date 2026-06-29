"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";

type Material = {
  name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
};

type Quotation = {
  id: string;
  materials: unknown;
  total_cost: number;
  ai_analysis: string | null;
  status: string;
};

export function QuotationSection({
  projectId,
  userId,
  existingQuotation,
  hasDrawings,
}: {
  projectId: string;
  userId: string;
  existingQuotation: Quotation | null;
  hasDrawings: boolean;
}) {
  const [generating, setGenerating] = useState(false);
  const [quotation, setQuotation] = useState<Quotation | null>(existingQuotation);

  async function generateQuotation() {
    setGenerating(true);
    try {
      const res = await fetch("/api/quotation/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, userId }),
      });
      const data = await res.json();
      if (data.quotation) setQuotation(data.quotation);
    } finally {
      setGenerating(false);
    }
  }

  const materials = (quotation?.materials ?? []) as Material[];

  return (
    <div className="bg-white rounded-xl p-6 border border-border">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-primary">Quotation</h2>
        {hasDrawings && (
          <button
            onClick={generateQuotation}
            disabled={generating}
            className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50 font-medium transition-colors"
          >
            {generating ? "Generating..." : quotation ? "Regenerate" : "Generate Quotation"}
          </button>
        )}
      </div>

      {!hasDrawings && !quotation && (
        <p className="text-text-muted text-sm">Upload engineering drawings to generate a quotation.</p>
      )}

      {quotation && (
        <div className="space-y-4">
          {quotation.ai_analysis && (
            <div className="p-4 bg-surface-alt rounded-lg">
              <p className="text-sm font-medium text-primary mb-1">AI Analysis</p>
              <p className="text-sm text-text-muted whitespace-pre-wrap">{quotation.ai_analysis}</p>
            </div>
          )}

          {materials.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 font-medium text-text-muted">Material</th>
                  <th className="text-right py-2 font-medium text-text-muted">Qty</th>
                  <th className="text-right py-2 font-medium text-text-muted">Unit Price</th>
                  <th className="text-right py-2 font-medium text-text-muted">Total</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((m, i) => (
                  <tr key={i} className="border-b border-surface-alt">
                    <td className="py-2 text-foreground">{m.name}</td>
                    <td className="py-2 text-right text-text-muted">{m.quantity} {m.unit}</td>
                    <td className="py-2 text-right text-text-muted">{formatCurrency(m.unit_price)}</td>
                    <td className="py-2 text-right font-medium text-foreground">{formatCurrency(m.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-primary/20">
                  <td colSpan={3} className="py-3 text-right font-semibold text-primary">Total</td>
                  <td className="py-3 text-right font-bold text-xl text-accent">
                    {formatCurrency(quotation.total_cost)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
