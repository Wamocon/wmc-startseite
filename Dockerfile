# Browser-Startseite WMC & WMA (WMCNL-2781)
#
# Mehrstufiger Build:
#   1) Python-Image führt das Prüfskript auf der Beispieldatei aus und bricht
#      ab, wenn die Prüfung fehlschlägt (B-01).
#   2) nginx-Image in fester Version (kein latest) kopiert site/ und die
#      nginx-Konfiguration (B-01).

# ---- Stufe 1: Prüfung der Linkliste ---------------------------------------
FROM python:3.12-slim AS pruefung
WORKDIR /app
COPY scripts/pruefe_links.py ./scripts/pruefe_links.py
COPY daten/beispiel/ ./daten/beispiel/
# Bricht ab, wenn das Prüfskript fehlschlägt.
RUN python3 scripts/pruefe_links.py daten/beispiel/links.json

# ---- Stufe 2: nginx ---------------------------------------------------------
FROM nginx:1.27.3-alpine AS produktiv
COPY --from=pruefung /dev/null /tmp/pruefung-erledigt
COPY nginx/startseite.conf /etc/nginx/conf.d/default.conf
COPY site/ /usr/share/nginx/html/

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
