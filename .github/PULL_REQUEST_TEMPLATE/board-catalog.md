<!-- Użyj tego szablonu dla PR dodających / poprawiających profile w community board catalog. -->

## Community board catalog

### Co zmieniasz
- [ ] Nowy profil
- [ ] Poprawka istniejącego profilu (VID/PID / chip / offset / baud)
- [ ] Tylko docs / walidator

### Checklist autora
- [ ] `id` unikalne (kebab-case)
- [ ] `chip` ∈ allowlista esptool (`esp32`, `esp32s2`, `esp32s3`, `esp32c2`, `esp32c3`, `esp32c5`, `esp32c6`, `esp32h2`, `esp32p4`, `auto`)
- [ ] `boardProfile` === `chip` (lub `auto`)
- [ ] Offset zgodny z chip family: classic `esp32` → `0x0` \| `0x1000`; Sx/Cx/H2/P4 → `0x0` (PLACEHOLDER może ostrzegać)
- [ ] Zaktualizowano lustro `BUNDLED_COMMUNITY_CATALOG` w `src/platform/boardSync.ts`
- [ ] `npm run test:board-catalog` oraz `npm run validate:board-catalog` zielone
- [ ] Podano źródło VID/PID (link) i jak zweryfikowano offset
- [ ] **Brak** sekretów / kluczy w diffie

### Źródła
- VID/PID:
- Offset / partition table:

### Test plan
- [ ] CI `Board catalog (community PR)` zielony
- [ ] (opcjonalnie) smoke pełny jeśli ruszasz sync runtime
