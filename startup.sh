#!/bin/bash




export DISPLAY=:0


#xinput map-to-output 'ILITEK       ILITEK-TOUCH' HDMI-1
xinput set-prop 'ILITEK       ILITEK-TOUCH' 'Coordinate Transformation Matrix' 0 -1 1 1 0 0 0 0 1



# Pour ecran integre
#left
#xinput set-prop 'ILITEK ILITEK-TP'  'Coordinate Transformation Matrix' 0 1 0 -1 0 1 0 0 1
#sudo xinput set-prop 'ILITEK ILITEK-TP'  'Coordinate Transformation Matrix' 0 -1 1 -1 0 1 0 0 1
#right
#xinput set-prop 'ILITEK ILITEK-TP'  'Coordinate Transformation Matrix' 0 -1 1 1 0 0 0 0 1

# Pour ecran HDMI 7
#left
#sudo xinput set-prop 'ILITEK ILITEK-TP' 'Coordinate Transformation Matrix' 0 1 0 -1 0 1 0 0 1
#right
#sudo xinput set-prop 'ILITEK ILITEK-TP'  'Coordinate Transformation Matrix' 0 -1 1 1 0 0 0 0 1


# Ouvrir un terminal et exécuter Electron
#xfce4-terminal --hold -e "bash -c 'cd /home/sd/Bureau/playzwell && electron .; exec bash'"

cd /home/sd/Bureau/Monky-front2
/home/sd/.nvm/versions/node/v22.7.0/bin/electron . &


#xinput set-prop 'ILITEK ILITEK-TP'  'Coordinate Transformation Matrix' 0 1 0 -1 0 1 0 0 1



# Pour ecran HDMI 15
#inverted
#sudo xinput set-prop 'Weida Hi-Tech CoolTouch® System'  'Coordinate Transformation Matrix' -1 0 1 0 -1 1 0 0 1
#normal
#sudo xinput set-prop 'Weida Hi-Tech CoolTouch® System'  'Coordinate Transformation Matrix' 1 0 0 0 1 0 0 0 1

#pour grand ecran borne chinoise
# sudo xinput set-prop 'Sharp Corp.   TPC-IC   USB HID'  'Coordinate Transformation Matrix' 0 -1 1 1 0 0 0 0 1


#####xinput set-prop 'ILITEK ILITEK-TP'  'Coordinate Transformation Matrix' -1 0 1 0 -1 1 0 0 1
#xinput map-to-output `xinput | grep Touchscreen | cut -d "=" -f 2 |cut -f 1` HDMI-1


#chromium-browser --allow-running-insecure-content --disable-features="TouchpadOverscrollHistoryNavigation" --start-fullscreen --kiosk --disable-pinch --overscroll-history-navigation=0   https://www.tslkaraoke.com?options=launcher	
#cd /home/sd/Bureau/playzwell
#electron .
