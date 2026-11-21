# Aktualizacje desktop

Podpisany wariant wydania udostępnia `latest.json` w stabilnym GitHub Release. Manifest wskazuje osobno NSIS, MSI, AppImage i archiwa aplikacji dla obu architektur macOS. Pakiety DEB aktualizuj przez instalację nowszego DEB — Studio pokazuje komunikat i przycisk **Pobierz z GitHub Releases**. Konfiguracja automatyzuje kanał stable.

- Ustaw `DESKTOP_UPDATER_SIGNED=true` i zapisz prywatny klucz w `TAURI_SIGNING_PRIVATE_KEY`. W razie potrzeby dodaj `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
- Publiczny klucz w `src-tauri/tauri.conf.json` musi odpowiadać kluczowi CI. Zachowaj go dla istniejących instalacji. Klucze prywatne przechowuj poza repozytorium.
- CI sprawdza, czy każdy podpis odpowiada pobieranemu binarium i publikowanej wersji. Brak klucza lub błędny podpis blokuje wydanie w trybie podpisanym.
- Sprawdź upgrade z istniejącej instalacji i ponowne uruchomienie. Użytkownicy wydania bez manifestu (oraz DEB) mogą pobrać instalator ręcznie z Releases z poziomu UI.
- Kanał beta nie wskazuje na `releases/latest`. Osobny manifest na tagu `beta-channel` trzeba opublikować i przetestować, zanim `BETA_CHANNEL_AVAILABLE` włączy wybór w Ustawieniach.

[Konfiguracja wydania](./desktop-unix.md)
