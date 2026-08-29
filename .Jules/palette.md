## 2025-02-18 - Standardized Accessible Back Navigation Buttons
**Learning:** Raw unicode arrow characters (`←`) in text buttons lack semantic context for screen readers and miss touch target minimum size standards (44px/min-h-11) on mobile devices.
**Action:** Replace `←` with Lucide `<ChevronLeft size={16} aria-hidden="true" />`, include explicit `aria-label`, and use `-ml-2 inline-flex min-h-11 items-center gap-1 px-2 btn-press transition-colors` for uniform accessibility and touch interaction.
