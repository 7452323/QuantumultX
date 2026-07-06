[rewrite_local]
^https?:\/\/api\.adapty\.io\/api\/v\d\/sdk\/(analytics\/profiles|in-apps\/(apple\/receipt\/validate|purchase-containers)|purchase\/app-store) url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Yomu.js

[mitm]
hostname = api.adapty.io
*/

const ddm = JSON.parse($response.body);
const headers = $request?.headers || {};
const profileid = headers['adapty-sdk-profile-id'] || headers['ADAPTY-SDK-PROFILE-ID'] || "";

const PRODUCT_ID = 'lifetime.yomu.app';
const BUNDLE_ID = 'yuemian.app';

const premium = {
    'id': 'premium',
    'is_lifetime': true,
    'store': 'app_store',
    'is_active': true,
    'is_in_grace_period': false,
    'activated_at': '2024-01-23T09:09:09.000000Z',
    'renewed_at': '2024-01-23T09:09:09.000+0000',
    'is_refund': false,
    'vendor_transaction_id': '490001271881589',
    'vendor_original_transaction_id': '490001271881589',
    'is_sandbox': false,
    'vendor_product_id': PRODUCT_ID
};

const receiptItem = {
    'quantity': '1',
    'transaction_id': '490001271881589',
    'original_transaction_id': '490001271881589',
    'purchase_date': '2024-01-12T00:00:00.000Z',
    'purchase_date_ms': '1705000949000',
    'expires_date': '2099-12-31T00:00:00.000Z',
    'expires_date_ms': '4070956800000',
    'is_trial_period': 'false',
    'is_in_intro_offer_period': 'false',
    'in_app_ownership_type': 'PURCHASED',
    'product_id': PRODUCT_ID
};

const subscription = Object.assign({}, premium);

if (/(analytics\/profiles|purchase\/app-store)/.test($request.url)) {
    ddm.data = {
        'type': 'profile_apple',
        'id': profileid,
        'attributes': {
            'profile_id': profileid,
            'apple_validation_result': {
                'environment': 'Production',
                'bundleId': BUNDLE_ID,
                'transactions': [{
                    'productId': PRODUCT_ID,
                    'storefront': 'CHN',
                    'originalTransactionId': '490001271881589',
                    'expiresDate': '2099-12-31T00:00:00.000Z',
                    'subscriptionGroupIdentifier': '21434634',
                    'purchaseDate': '2024-01-12T00:00:00.000Z',
                    'transactionId': '490001271881589',
                    'inAppOwnershipType': 'PURCHASED'
                }]
            },
            'subscriptions': { [PRODUCT_ID]: subscription },
            'paid_access_levels': { 'premium': subscription }
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
                    'in_app': [receiptItem],
                    'original_purchase_date': '2024-01-12T00:00:00.000Z'
                },
                'status': 0,
                'latest_receipt_info': [receiptItem]
            },
            'subscriptions': { [PRODUCT_ID]: subscription },
            'paid_access_levels': { 'premium': subscription }
        }
    };
}

$done({body: JSON.stringify(ddm)});