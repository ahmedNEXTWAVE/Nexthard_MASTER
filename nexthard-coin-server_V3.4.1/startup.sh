
# --- Fonction de nettoyage ---
# Cette fonction est appelée lorsqu'un signal d'arrêt (comme Ctrl+C) est reçu.
cleanup() {
    echo ""
    echo "Signal de terminaison reçu. Arrêt du processus ITL en arrière-plan (PID: $PID_CASH)..."
    # Tente d'abord une terminaison en douceur (SIGTERM)
    kill -TERM $PID_CASH 2>/dev/null
    # Attendre un instant pour la terminaison
    sleep 1
    
    # Vérifie si le processus est toujours en cours d'exécution et le tue de force si nécessaire
    if kill -0 $PID_CASH 2>/dev/null; then
        echo "Le processus ITL $PID_CASH est toujours actif. Arrêt forcé (SIGKILL)."
        kill -KILL $PID_CASH 2>/dev/null
    fi
    echo "Processus d'arrière-plan arrêté. Sortie du script."
    exit 0
}

# 4. Le TRAP (Capture): Assure que la fonction 'cleanup' est appelée sur SIGINT (Ctrl+C) ou SIGTERM.
# Nous plaçons le trap tôt pour qu'il soit actif dès que PID_CASH est défini.
trap cleanup INT TERM

echo "Starting ITL REST API server in background..."

# 1. Start the first server (ITL REST API) in the background
# The '||' stops the script if the directory is not found.
cd "./NET_8.0/" || { echo "Error: Directory not found. Aborting."; exit 1; }
dotnet CashDevice-RestAPI.dll
PID_CASH=$!                  # Stores the process ID (PID) of the background job