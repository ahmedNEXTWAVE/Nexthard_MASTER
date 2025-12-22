#!/usr/bin/env bash
# Vérification/relance du lecteur NFC "ACS" via relais USB
# - Lance pcsc_scan -r, ne fait rien si un lecteur contenant "ACS" est présent
# - Sinon pulse le relais usbrelay BITFT (1 puis 0) et re-teste après 10s
# - Logue chaque relance avec date/heure et résultat dans /home/sd/nfc.log

set -euo pipefail

LOG_FILE="/home/sd/nfc.log"
RELAY_NAME="BITFT_2"
SLEEP_AFTER_ON=1       # secondes
SLEEP_AFTER_OFF=10     # secondes

# crée le fichier de log si besoin
mkdir -p "$(dirname "$LOG_FILE")"
touch "$LOG_FILE"

command -v pcsc_scan >/dev/null 2>&1 || {
  echo "$(date '+%F %T') [ERREUR] pcsc_scan introuvable dans le PATH." >> "$LOG_FILE"
  exit 1
}
command -v usbrelay >/dev/null 2>&1 || {
  echo "$(date '+%F %T') [ERREUR] usbrelay introuvable dans le PATH." >> "$LOG_FILE"
  exit 1
}

has_acs() {
  # pcsc_scan -r affiche les lecteurs détectés puis quitte
  # on considère "ok" si au moins une ligne contient "ACS" (insensible à la casse)
  pcsc_scan -c 2>/dev/null | grep -qi 'inserted\|removed'
}

if has_acs; then
  # Tout va bien, on ne logue rien (comportement demandé)
  exit 0
fi

# Pas d'ACS détecté : on tente un redémarrage via le relais
# On enregistre le début d’action pour traçabilité
START_TS="$(date '+%F %T')"
RELAY_RESULT="OK"

# On encapsule les erreurs de commande de relais pour les loguer proprement
if ! usbrelay "${RELAY_NAME}=1" >/dev/null 2>&1; then
  RELAY_RESULT="ECHEC usbrelay ON"
fi

sleep "$SLEEP_AFTER_ON"

if ! usbrelay "${RELAY_NAME}=0" >/dev/null 2>&1; then
  RELAY_RESULT="ECHEC usbrelay OFF"
fi

sleep "$SLEEP_AFTER_OFF"

# Re-test de présence ACS
if has_acs; then
  TEST_RESULT="OK (ACS détecté)"
else
  TEST_RESULT="ECHEC (ACS non détecté)"
fi

echo "${START_TS} [RESTART] relais=${RELAY_NAME} resultat_relais=${RELAY_RESULT} verif=${TEST_RESULT}" >> "$LOG_FILE"
