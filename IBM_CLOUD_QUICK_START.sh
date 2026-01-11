#!/bin/bash

# IBM Cloud Kubernetes Deployment Script
# Run this after you've created your cluster and logged in

set -e

echo "🚀 IBM Cloud X1 Bot Deployment Script"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if required commands exist
command -v kubectl >/dev/null 2>&1 || { echo -e "${RED}❌ kubectl is not installed. Please install it first.${NC}" >&2; exit 1; }
command -v ibmcloud >/dev/null 2>&1 || { echo -e "${RED}❌ ibmcloud CLI is not installed. Please install it first.${NC}" >&2; exit 1; }

# Prompt for cluster name
read -p "Enter your cluster name [default: x1-bot-cluster]: " CLUSTER_NAME
CLUSTER_NAME=${CLUSTER_NAME:-x1-bot-cluster}

echo -e "${BLUE}📡 Connecting to cluster: $CLUSTER_NAME${NC}"
ibmcloud ks cluster config --cluster $CLUSTER_NAME

echo ""
echo -e "${BLUE}📋 Creating namespace...${NC}"
kubectl create namespace x1-bot --dry-run=client -o yaml | kubectl apply -f -

echo ""
echo -e "${YELLOW}🔑 Please enter your bot credentials:${NC}"
read -p "Telegram Bot Token: " BOT_TOKEN
read -p "X1 RPC URL [default: https://x1-mainnet.infrafc.org]: " X1_RPC_URL
X1_RPC_URL=${X1_RPC_URL:-https://x1-mainnet.infrafc.org}

echo ""
echo -e "${BLUE}🔐 Creating secrets...${NC}"
kubectl create secret generic x1-bot-secrets \
  --from-literal=BOT_TOKEN="$BOT_TOKEN" \
  --namespace=x1-bot \
  --dry-run=client -o yaml | kubectl apply -f -

echo ""
echo -e "${BLUE}📦 Applying configurations...${NC}"
kubectl apply -f kubernetes/deployment-ibm-simple.yaml

echo ""
echo -e "${BLUE}⏳ Waiting for deployment...${NC}"
kubectl wait --for=condition=available --timeout=300s deployment/x1-wallet-watcher -n x1-bot || true

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo -e "${BLUE}📊 Pod status:${NC}"
kubectl get pods -n x1-bot

echo ""
echo -e "${BLUE}📝 View logs with:${NC}"
POD_NAME=$(kubectl get pods -n x1-bot -l app=x1-wallet-watcher -o jsonpath='{.items[0].metadata.name}')
echo "kubectl logs -f $POD_NAME -n x1-bot"

echo ""
echo -e "${GREEN}🎉 Your bot should now be running!${NC}"
echo -e "${YELLOW}Test it on Telegram by sending /start to your bot${NC}"
