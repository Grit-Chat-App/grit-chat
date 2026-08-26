# Firebase generates record requirements only after each CustomDomain exists.
# Group individual desired records into complete RRsets here, because the Cloud DNS
# provider treats each name-and-type resource as authoritative. Creating one
# Terraform resource per value would let a later apply erase a sibling value.
locals {
  firebase_dns_records_flat = flatten([
    for custom_domain in [
      google_firebase_hosting_custom_domain.apex,
      google_firebase_hosting_custom_domain.www,
      ] : flatten([
        for update in custom_domain.required_dns_updates : flatten([
          for desired in update.desired : [
            for record in desired.records : {
              name  = endswith(record.domain_name, ".") ? record.domain_name : "${record.domain_name}."
              type  = record.type
              rdata = record.rdata
            }
          ]
        ])
    ])
  ])

  firebase_dns_records = {
    for key, records in {
      for record in local.firebase_dns_records_flat :
      "${lower(trimsuffix(record.name, "."))}|${record.type}" => record...
      } : key => {
      name    = records[0].name
      type    = records[0].type
      rrdatas = distinct([for record in records : record.rdata])
    }
  }
}
