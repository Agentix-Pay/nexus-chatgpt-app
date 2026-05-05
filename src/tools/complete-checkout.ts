import { z } from 'zod';
import { nexus } from '../client.js';

const inputSchema = z.object({
  checkoutId: z.string().min(1),
  /** Optional explicit payment token. Omit to charge the user's card on file. */
  paymentToken: z.string().optional(),
});

export const completeCheckoutTool = {
  name: 'complete_checkout',
  description:
    'Finalize an in-chat checkout (Flow A). With OAuth + Stripe via the SDK bridge, this charges the user\'s saved payment method through the merchant\'s gateway. The response includes a payment.summary string ("Charged $X to Visa ending 4242") — render that in the OrderConfirmation UI.',
  inputSchema,
  outputUI: 'OrderConfirmation',
  handler: async (
    input: z.infer<typeof inputSchema>,
    ctx: { jwt?: string; fallbackApiKey?: string },
  ) => {
    if (!ctx.jwt) {
      return {
        error: {
          code: 'AUTH_REQUIRED',
          message: 'In-chat checkout requires the shopper to be signed in. Prompt the OAuth flow.',
        },
      };
    }
    const result = await nexus.post<{
      checkout: unknown;
      order: { orderNumber: string; totalCents: number };
      payment: { summary: string; mode: 'demo' | 'real'; method?: string; last4?: string };
    }>(
      `/acp/v1/checkouts/${encodeURIComponent(input.checkoutId)}/complete`,
      input.paymentToken ? { paymentToken: input.paymentToken } : {},
      { jwt: ctx.jwt },
    );
    if (!result.ok) {
      return { error: { code: result.code, message: result.message } };
    }
    return { checkout: result.data.checkout, order: result.data.order, payment: result.data.payment };
  },
};
