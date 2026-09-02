# WebMCP tool contracts

Read: `get_room_state`, `search_catalog`, `get_product_detail`, `get_budget_status`, `check_clearances`.

Propose without mutation: `propose_place_item`, `propose_move_item`, `propose_swap_item`, `propose_full_layout`.

Gate: `list_pending_proposals`, `get_proposal_status`, `apply_approved_change`.

Protected: `book_showroom_visit`, `submit_quote_request`.

Close: `generate_evidence_receipt`.

Stable failures include `INVALID_INPUT`, `VERSION_CONFLICT`, `PROPOSAL_EXPIRED`, `PROPOSAL_NOT_APPROVED`, `PROPOSAL_REJECTED`, `PROPOSAL_SUPERSEDED`, `IDEMPOTENCY_CONFLICT`, `CONFIRMATION_REQUIRED`, `CONFIRMATION_EXPIRED`, and `POLICY_BLOCKED`.
