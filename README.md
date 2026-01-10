## Startup guide

1. setup .env file:
   ---NEXTHARD-SERVER
   host=<>
   port=<>
   protocol=mqtts/mqtt
   topic=nexthard101
   topic_pilot=nexthard101/pilote
   username=''
   password=''
   ---NEXTHARD-COIN-SERVER
   host=<>
   port=<>
   protocol=mqtts/mqtt
   topic="Playzwell/nexthard99"
   mqtt_user=<>
   mqtt_pass=<>
   coin_port=/dev/coins
   cash_port=/dev/cash
   itl_url=<>
   token=<> --- auto generated
   itl_user=admin
   itl_pass=password

# features list

payout=0 / 1 -- activate the payout feature (requires the nexthard_coin_server running)
card_d=0 / 1 -- activate card dispenser
stripe=0 / 1 -- activate stripe pay (tpe)
printer=0 / 1 -- activate thermal printer

2. Run required servers:
   Payout version:

- cd "./NET_8.0/"
- dotnet CashDevice-RestAPI.dll
- cd ../
- node nexthard_server.js
  No Payout version:
- sudo node nexthard_server.js
