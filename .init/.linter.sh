#!/bin/bash
cd /home/kavia/workspace/code-generation/real-time-navigation-dashboard-9176-9185/frontend_dashboard
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

