# --- Test API ---

# --- one-time, per shell ---

export HERMES_HOST=https://100.78.19.81:8444
export HERMES_PASS='test1234'
COOKIE=/tmp/hermes.jar

# Login (saves claude-auth cookie to $COOKIE)

curl -sk -c "$COOKIE" -X POST "$HERMES_HOST/api/auth" \
 -H "Content-Type: application/json" \
 -d "{\"password\":\"$HERMES_PASS\"}"
echo

# --- create the protocol ---

curl -sk -b "$COOKIE" -X POST "$HERMES_HOST/api/genomics/protocols" \
 -H "Content-Type: application/json" \
 -d '{
"name": "TNGS Oncology Report",
"version": "2.1",
"assay_type": "TNGS",
"description": "Full somatic TNGS report",
"prompt_template": "Generate a 12-section Molecular Pathology report for patient {{patient_name}} with diagnosis {{diagnosis}}. VCF: {{vcf_path}}.",
"skills": ["vcf-interpretation","oncokb-lookup","civic-lookup","trial-matcher"
,"report-writer-12section"],
"variables": [
{"name":"patient_name","label":"Patient Name","source":"case.patient_name","editable":false},
{"name":"diagnosis","label":"Diagnosis","source":"case.diagnosis","editable"
:true},
{"name":"vcf_path","label":"VCF Path","source":"manual","editable":true}
]
}' | jq .
