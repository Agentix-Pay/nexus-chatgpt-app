/**
 * Server-wide toggle to hide the custom widget (iframe UI) and fall back to
 * plain chat text + real (non-base64) image links for every host, ChatGPT
 * included.
 *
 * Added live after a report that ChatGPT showed everything twice — once in
 * the widget, once narrated in chat text (fixed separately by shrinking the
 * chat-text caption). This toggle is a stopgap for turning the widget off
 * entirely while its UX gets sorted out further, without losing images: set
 * WIDGET_ENABLED=false and every tool's chat text becomes a markdown listing
 * with real image links instead of the widget's iframe. Flip it back to
 * true (or unset it — true is the default) to restore the widget.
 */
export const WIDGET_ENABLED = process.env['WIDGET_ENABLED'] !== 'false';

/**
 * Cart/checkout tools whose widget is suppressed even when WIDGET_ENABLED is
 * true, because ChatGPT appears to render its own native cart/checkout UI
 * (a styled summary + "Checkout my cart" button, shown as a normal chat
 * message below our widget) whenever structuredContent looks like a cart —
 * reported live via screenshot: the widget's cart card AND a second,
 * ChatGPT-native cart card with its own checkout button both appeared for
 * the same add_to_cart call. Browsing tools (list_merchants/list_categories/
 * search_products/get_product) don't trigger this — only cart/checkout data
 * does — so this is scoped to exactly those tools rather than using the
 * blunt global WIDGET_ENABLED toggle.
 */
const NO_WIDGET_TOOLS = new Set(['add_to_cart', 'view_cart', 'checkout_cart', 'create_handoff']);

export function toolWantsWidget(toolName: string): boolean {
  return WIDGET_ENABLED && !NO_WIDGET_TOOLS.has(toolName);
}
