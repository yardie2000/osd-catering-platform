import {
  aggregatePurchasing,
  DEFAULT_CALC_CONFIG,
  type CalcConfig,
  type CalcInputRow,
  type PurchasingResult,
} from '@/lib/purchasing/aggregate'
import { buildProductionPlan, type ProductionPlanResult } from '@/lib/production/plan'
import type { SupplierProduct } from '@/types'

// Re-export so callers can keep a single import site for the engine config.
export { DEFAULT_CALC_CONFIG, type CalcConfig }
export const DEFAULT_BASE_PORTIONS = DEFAULT_CALC_CONFIG.defaultBasePortions

export type BatchOutputs = {
  production: ProductionPlanResult
  purchasing: PurchasingResult
}

/**
 * Single source of truth for batch outputs: one set of (menu, pax) rows →
 * BOTH the production plan and the purchasing list, via the same recipe-scaling
 * logic and the same CalcConfig (base portions, production loss %, yield %).
 * Production and purchasing therefore always derive from an identical basis:
 *   Required   = recipeQty × (pax / base)
 *   Production = Required × (1 + loss%)
 *   Purchasing = Production ÷ yield%
 */
export function computeBatchOutputs(
  rows: CalcInputRow[],
  units: { id: string; unit_code: string; name: string; short_name: string | null }[],
  supplierProducts: SupplierProduct[],
  config: CalcConfig = DEFAULT_CALC_CONFIG,
): BatchOutputs {
  return {
    production: buildProductionPlan(rows, config),
    purchasing: aggregatePurchasing(rows, supplierProducts, config, units),
  }
}
