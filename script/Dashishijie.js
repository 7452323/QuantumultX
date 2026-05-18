/*
大师视界 - 大师水印相机边框水印照片参数exif
https://apps.apple.com/cn/app/id6476436343

[rewrite_local]
^https:\/\/buy\.itunes\.apple\.com\/verifyReceipt url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Dashishijie.js

[mitm]
hostname = buy.itunes.apple.com
*/

var obj = JSON.parse($response.body);

obj = {
  "environment": "Production",
  "receipt": {
    "receipt_type": "Production",
    "app_item_id": 6476436343,
    "receipt_creation_date": "2099-12-31 23:59:59 Etc/GMT",
    "bundle_id": "com.supercreativityinspire.imageviewer",
    "original_purchase_date": "2099-12-31 23:59:59 Etc/GMT",
    "in_app": [
      {
        "quantity": "1",
        "purchase_date_ms": "4092599349000",
        "expires_date": "2099-12-31 23:59:59 Etc/GMT",
        "expires_date_pst": "2099-12-31 15:59:59 America/Los_Angeles",
        "is_in_intro_offer_period": "false",
        "transaction_id": "520002450573219",
        "is_trial_period": "false",
        "original_transaction_id": "520002450573219",
        "purchase_date": "2099-12-31 23:59:59 Etc/GMT",
        "product_id": "com.supercreativityinspire.imageviewer.yearly",
        "original_purchase_date_pst": "2099-12-31 15:59:59 America/Los_Angeles",
        "in_app_ownership_type": "PURCHASED",
        "original_purchase_date_ms": "4092599349000",
        "web_order_line_item_id": "220000994998142",
        "expires_date_ms": "4092599349000",
        "purchase_date_pst": "2099-12-31 15:59:59 America/Los_Angeles",
        "original_purchase_date": "2099-12-31 23:59:59 Etc/GMT"
      }
    ],
    "adam_id": 6476436343,
    "receipt_creation_date_pst": "2099-12-31 15:59:59 America/Los_Angeles",
    "request_date": "2099-12-31 23:59:59 Etc/GMT",
    "request_date_pst": "2099-12-31 15:59:59 America/Los_Angeles",
    "version_external_identifier": 868619334,
    "request_date_ms": "4092599349000",
    "original_purchase_date_pst": "2099-12-31 15:59:59 America/Los_Angeles",
    "application_version": "208",
    "original_purchase_date_ms": "4092599349000",
    "receipt_creation_date_ms": "4092599349000",
    "original_application_version": "100",
    "download_id": null
  },
  "pending_renewal_info": [
    {
      "product_id": "com.supercreativityinspire.imageviewer.yearly",
      "original_transaction_id": "520002450573219",
      "auto_renew_product_id": "com.supercreativityinspire.imageviewer.yearly",
      "auto_renew_status": "1"
    }
  ],
  "status": 0,
  "latest_receipt_info": [
    {
      "quantity": "1",
      "purchase_date_ms": "4092599349000",
      "expires_date": "2099-12-31 23:59:59 Etc/GMT",
      "expires_date_pst": "2099-12-31 15:59:59 America/Los_Angeles",
      "is_in_intro_offer_period": "false",
      "transaction_id": "520002450573219",
      "app_account_token": "b399ff8e-4c4c-49ba-ac5e-99c5efb680b8",
      "is_trial_period": "false",
      "original_transaction_id": "520002450573219",
      "purchase_date": "2099-12-31 23:59:59 Etc/GMT",
      "product_id": "com.supercreativityinspire.imageviewer.yearly",
      "original_purchase_date_pst": "2099-12-31 15:59:59 America/Los_Angeles",
      "in_app_ownership_type": "PURCHASED",
      "subscription_group_identifier": "21022021",
      "original_purchase_date_ms": "4092599349000",
      "web_order_line_item_id": "220000994998142",
      "expires_date_ms": "4092599349000",
      "purchase_date_pst": "2099-12-31 23:59:59 America/Los_Angeles",
      "original_purchase_date": "2099-12-31 23:59:59 Etc/GMT"
    }
  ]
};

$done({ body: JSON.stringify(obj) });