/*
Yomu 漫画阅读器 - Adapty 会员解锁
https://apps.apple.com/app/id6760745234

[rewrite_local]
^https?:\/\/api\.adapty\.io\/api\/v\d\/sdk\/(analytics\/profiles|in-apps\/(apple\/receipt\/validate|purchase-containers)|purchase\/app-store) url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Yomu.js

[mitm]
hostname = api.adapty.io
*/

const ddm = JSON.parse($response.body);
const headers = $request?.headers || {};
const ua = headers['User-Agent'] || headers['user-agent'] || "";
const profileid = headers['adapty-sdk-profile-id'] || headers['ADAPTY-SDK-PROFILE-ID'] || "";

const premiumTemplate = {
    'id': 'premium',
    'is_lifetime': true,
    'store': 'app_store',
    'starts_at': '2024-01-23T09:09:09.000000Z',
    'expires_at': null,
    'will_renew': true,
    'is_active': true,
    'is_in_grace_period': false,
    'activated_at': '2024-01-23T09:09:09.000000Z',
    'renewed_at': '2024-01-23T09:09:09.000+0000',
    'is_refund': false,
    'vendor_transaction_id': '490001271881589',
    'vendor_original_transaction_id': '490001271881589',
    'is_sandbox': false,
    'active_introductory_offer_type': 'intro_price'
};

const receiptTemplate = {
    'quantity': '1',
    'purchase_date_ms': '1705000949000',
    'expires_date': '2099-12-31T00:00:00.000Z',
    'is_in_intro_offer_period': 'false',
    'transaction_id': '490001271881589',
    'is_trial_period': 'false',
    'original_transaction_id': '490001271881589',
    'purchase_date': '2024-01-12T00:00:00.000Z',
    'in_app_ownership_type': 'PURCHASED',
    'original_purchase_date_ms': '1705000949000',
    'expires_date_ms': '4070956800000'
};

const PRODUCT_ID = 'lifetime.yomu.app';
const BUNDLE_ID = 'yuemian.app';

const subscriptions = {};
subscriptions[PRODUCT_ID] = Object.assign({}, premiumTemplate, {'vendor_product_id': PRODUCT_ID});

const receiptdata = [];
receiptdata.push(Object.assign({}, receiptTemplate, {'product_id': PRODUCT_ID}));

if (/(analytics\/profiles|purchase\/app-store)/.test($request.url)) {
    ddm.data = {
        'type': 'profile_apple',
        'id': profileid,
        'attributes': {
            'profile_id': profileid,
            'is_test_user': false,
            'segment_hash': 'deaf-and-dumb',
            'timestamp': Date.now(),
            'apple_validation_result': {
                'environment': 'Production',
                'revision': '1706-ba',
                'appAppleId': 1234567890,
                'transactions': [
                    {
                        'productId': PRODUCT_ID,
                        'storefront': 'CHN',
                        'originalTransactionId': '490001271881589',
                        'expiresDate': '2099-12-31T00:00:00.000Z',
                        'subscriptionGroupIdentifier': '21434634',
                        'purchaseDate': '2024-01-12T00:00:00.000Z',
                        'price': 0,
                        'transactionId': '490001271881589',
                        'currency': 'CNY',
                        'inAppOwnershipType': 'PURCHASED'
                    }
                ],
                'hasMore': false,
                'bundleId': BUNDLE_ID
            },
            'subscriptions': subscriptions,
            'paid_access_levels': {
                'premium': Object.assign({}, premiumTemplate, {'vendor_product_id': PRODUCT_ID})
            }
        }
    };
}

if (/(receipt\/validate|purchase-containers)/.test($request.url)) {
    ddm.data = {
        'type': 'profile_apple',
        'id': profileid,
        'attributes': {
            'profile_id': profileid,
            'apple_validation_result': {
                'environment': 'Production',
                'receipt': {
                    'receipt_type': 'Production',
                    'bundle_id': BUNDLE_ID,
                    'in_app': receiptdata,
                    'original_purchase_date': '2024-01-12T00:00:00.000Z',
                    'adam_id': 1234567890,
                    'request_date': '2026-01-23T00:00:00.000Z',
                    'request_date_ms': '1706000949000',
                    'application_version': '1',
                    'original_application_version': '1'
                },
                'status': 0,
                'pending_renewal_info': [
                    {
                        'expiration_intent': '1',
                        'product_id': PRODUCT_ID,
                        'is_in_billing_retry_period': '0',
                        'auto_renew_product_id': PRODUCT_ID,
                        'original_transaction_id': '490001271881589',
                        'auto_renew_status': '0'
                    }
                ],
                'latest_receipt_info': receiptdata,
                'latest_receipt': 'MIIuMgYyoHBu2nN...'
            },
            'subscriptions': subscriptions,
            'paid_access_levels': {
                'premium': Object.assign({}, premiumTemplate, {'vendor_product_id': PRODUCT_ID})
            }
        }
    };
}

$done({body: JSON.stringify(ddm)});