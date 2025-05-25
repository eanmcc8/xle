#!/bin/bash
vercel env add SLACK_INCOMING_WEBHOOK 
vercel env add IMGBB_API_KEY
vercel deploy
