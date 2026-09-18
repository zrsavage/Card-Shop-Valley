import type { RecurringFees } from './types';

export interface RecurringFeeDef {
  key: keyof RecurringFees;
  name: string;
  weeklyCost: number;
  payoffCost: number;
  description: string;
}

// The weekly cost of living — one serious line item and a few the town's
// bureaucracy has clearly invented to pad its own budget. Each is a
// permanent, one-time payoff at Town Hall, not a delayed unlock — pay it
// once and that line never appears on the bill again.
export const RECURRING_FEE_DEFS: RecurringFeeDef[] = [
  {
    key: 'rentWaived',
    name: 'Shop Rent',
    weeklyCost: 60,
    payoffCost: 900,
    description: "The landlord still owns the building under your shop and expects to hear from you every week.",
  },
  {
    key: 'processingFeeWaived',
    name: 'Processing Fee',
    weeklyCost: 15,
    payoffCost: 250,
    description: 'A fee charged weekly for the town\'s trouble in processing the fee you just paid.',
  },
  {
    key: 'mailInFeeWaived',
    name: 'Mail-In Fee',
    weeklyCost: 12,
    payoffCost: 200,
    description: "Somebody has to carry your paperwork to the next town over. That somebody bills you for it.",
  },
  {
    key: 'taxFeeWaived',
    name: 'Tax Fee',
    weeklyCost: 18,
    payoffCost: 300,
    description: 'Not to be confused with taxes. This is simply a fee, levied for tax-related reasons.',
  },
  {
    key: 'respawnFeeWaived',
    name: 'Resurrection Insurance',
    weeklyCost: 10,
    payoffCost: 150,
    description: "You've never actually died, not once. The town bills you for the coverage anyway, just in case.",
  },
  {
    key: 'electricityWaived',
    name: 'Electricity',
    weeklyCost: 20,
    payoffCost: 350,
    description: 'Keeps the shop lights on. Somehow still flickers out mid-festival every single year.',
  },
  {
    key: 'runningWaterWaived',
    name: 'Running Water',
    weeklyCost: 14,
    payoffCost: 220,
    description: "The fountain runs on a totally separate budget, apparently. This one's just for your sink.",
  },
  {
    key: 'developerFeeWaived',
    name: "Developer's Fee",
    weeklyCost: 25,
    payoffCost: 400,
    description: 'Nobody in town can explain what this actually pays for. It shows up on the bill regardless.',
  },
];
