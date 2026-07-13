#!/usr/bin/env bash

set -euo pipefail

RAILWAY_ENVIRONMENT_NAME="${RAILWAY_ENVIRONMENT_NAME:-production}"
RAILWAY_SERVICE_NAME="${RAILWAY_SERVICE_NAME:-${EMORAPY_RAILWAY_SERVICE_NAME:-mother-bear-court}}"
PREVIOUS_DEPLOYMENT_ID="${PREVIOUS_DEPLOYMENT_ID:-}"
EXPECTED_DEPLOYMENT_ID="${EXPECTED_DEPLOYMENT_ID:-}"
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

read_expected_deployment() {
  railway deployment list \
    --environment "${RAILWAY_ENVIRONMENT_NAME}" \
    --service "${RAILWAY_SERVICE_NAME}" \
    --limit 100 \
    --json \
    | jq -r --arg deployment_id "${EXPECTED_DEPLOYMENT_ID}" '
        .[]
        | select(.id == $deployment_id)
        | [(.id // ""), (.status // "UNKNOWN")]
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
if [ -n "${EXPECTED_DEPLOYMENT_ID}" ] && [ "${EXPECTED_DEPLOYMENT_ID}" = "${PREVIOUS_DEPLOYMENT_ID}" ]; then
  fail "expected deployment must differ from the previous deployment"
fi

observed_new_deployment=false

while (( SECONDS < deadline )); do
  if [ -n "${EXPECTED_DEPLOYMENT_ID}" ]; then
    latest="$(read_expected_deployment || true)"
  else
    latest="$(read_latest_deployment || true)"
  fi
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
  if [ -n "${EXPECTED_DEPLOYMENT_ID}" ] && [ "${latest_id}" != "${EXPECTED_DEPLOYMENT_ID}" ]; then
    fail "resolved deployment ${latest_id} does not match expected ${EXPECTED_DEPLOYMENT_ID}"
  fi
  log "deployment ${latest_id} status=${latest_status}"

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
