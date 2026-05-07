/**
 * Tool registry — each tool is a (name, schema, handler) triple wired into the
 * MCP server. Tools are the surface ChatGPT actually calls; UI components
 * render their results.
 */

import { listMerchantsTool } from './list-merchants.js';
import { listCategoriesTool } from './list-categories.js';
import { searchProductsTool } from './search-products.js';
import { getProductTool } from './get-product.js';
import { createCheckoutTool } from './create-checkout.js';
import { completeCheckoutTool } from './complete-checkout.js';
import { createHandoffTool } from './create-handoff.js';
import { getOrderStatusTool } from './get-order-status.js';

export const tools = [
  listMerchantsTool,
  listCategoriesTool,
  searchProductsTool,
  getProductTool,
  createCheckoutTool,
  completeCheckoutTool,
  createHandoffTool,
  getOrderStatusTool,
];

export type Tool = (typeof tools)[number];
