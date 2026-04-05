#!/usr/bin/env bash

set -euo pipefail

RAILWAY_ENVIRONMENT_NAME="${RAILWAY_ENVIRONMENT_NAME:-staging}"
RAILWAY_SERVICE_NAME="${RAILWAY_SERVICE_NAME:-mother-bear-court}"
PREVIOUS_DEPLOYMENT_ID="${PREVIOUS_DEPLOYMENT_ID:-}"
DEPLOY_TIMEOUT_SECONDS="${DEPLOY_TIMEOUT_SECONDS:-900}"
DEPLOY_POLL_INTERVAL_SECONDS="${DEPLOY_POLL_INTERVAL_SECONDS:-5}"

log() {
  echo "[wait-railway-deploy] $*"
}

fail() {
  echo "[wait-railway-deploy] FAIL: $*" >&2
  exit 1
}

read_latest_deployment() {
  railway status --json | jq -r \
    --arg env_name "${RAILWAY_ENVIRONMENT_NAME}" \
    --arg service_name "${RAILWAY_SERVICE_NAME}" '
      .environments.edges[]
      | select(.node.name == $env_name)
      | .node.serviceInstances.edges[]
      | select(.node.serviceName == $service_name)
      | [(.node.latestDeployment.id // ""), (.node.latestDeployment.status // "UNKNOWN")]
      | @tsv
    '
}

if ! command -v railway >/dev/null 2>&1; then
  fail "railway CLI is required"
fi

if ! command -v jq >/dev/null 2>&1; then
  fail "jq is required"
fi

deadline=$((SECONDS + DEPLOY_TIMEOUT_SECONDS))
observed_new_deployment=false

while (( SECONDS < deadline )); do
  latest="$(read_latest_deployment || true)"
  if [ -z "${latest}" ]; then
    sleep "${DEPLOY_POLL_INTERVAL_SECONDS}"
    continue
  fi

  latest_id="${latest%%$'\t'*}"
  latest_status="${latest#*$'\t'}"

  if [ -z "${latest_id}" ]; then
    sleep "${DEPLOY_POLL_INTERVAL_SECONDS}"
    continue
  fi

  if [ -n "${PREVIOUS_DEPLOYMENT_ID}" ] && [ "${latest_id}" = "${PREVIOUS_DEPLOYMENT_ID}" ] && [ "${observed_new_deployment}" = false ]; then
    log "waiting for a new deployment after ${PREVIOUS_DEPLOYMENT_ID}"
    sleep "${DEPLOY_POLL_INTERVAL_SECONDS}"
    continue
  fi

  observed_new_deployment=true
  log "latest deployment ${latest_id} status=${latest_status}"

  case "${latest_status}" in
    SUCCESS)
      log "deployment succeeded"
      exit 0
      ;;
    BUILDING|DEPLOYING|INITIALIZING|PENDING|QUEUED)
      sleep "${DEPLOY_POLL_INTERVAL_SECONDS}"
      ;;
    *)
      fail "deployment ${latest_id} entered terminal status ${latest_status}"
      ;;
  esac
done

fail "timed out waiting for ${RAILWAY_SERVICE_NAME} deployment in ${RAILWAY_ENVIRONMENT_NAME}"
