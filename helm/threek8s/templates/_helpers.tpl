{{/*
Expand the name of the chart.
*/}}
{{- define "threek8s.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "threek8s.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "threek8s.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "threek8s.labels" -}}
helm.sh/chart: {{ include "threek8s.chart" . }}
{{ include "threek8s.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "threek8s.selectorLabels" -}}
app.kubernetes.io/name: {{ include "threek8s.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "threek8s.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "threek8s.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Create the name of the config map to use
*/}}
{{- define "threek8s.configMapName" -}}
{{- if .Values.configMap.name }}
{{- .Values.configMap.name }}
{{- else }}
{{- printf "%s-config" (include "threek8s.fullname" .) }}
{{- end }}
{{- end }}

{{/*
Create backend service URL for frontend
*/}}
{{- define "threek8s.backendUrl" -}}
{{- printf "http://%s-backend:%d" (include "threek8s.fullname" .) (.Values.backend.service.port | int) }}
{{- end }}

{{/*
Create backend WebSocket URL for frontend
*/}}
{{- define "threek8s.backendWsUrl" -}}
{{- printf "ws://%s-backend:%d" (include "threek8s.fullname" .) (.Values.backend.service.port | int) }}
{{- end }}