"use strict";
/**
 * Project: sendo_sale_hunter
 * Author: Le Hai Diep(dieple)
 * Date-Time: 18/06/2019-21:51
 */

const https = require("https");
const nodeSchedule = require('node-schedule');
const winston = require('winston');

const Cookie = `tracking_id=955fc5c286344abf8b69526d7bf6b1d0; browserid=8b4f7eac60bff5c10715c149ff32d94d; __utmz=147100981.1560079024.1.1.utmcsr=(direct)|utmccn=(direct)|utmcmd=(none); _gcl_au=1.1.1222511145.1560079024; cto_lwid=d3a8769e-51d0-4e5c-991b-86e0f6b7d5f9; _ga=GA1.2.2042790980.1560079024; _fbp=fb.1.1560079025407.1101395990; s_c_id_type=fosp; login_type=fosp; _ga=GA1.3.2042790980.1560079024; __stdf=0; mp_7ee9ac5438d5ed68c57319eb6bf3821f_mixpanel=%7B%22distinct_id%22%3A%20%2216b55dd3ec9249-010a5d62d5b0df-3f72045a-100200-16b55dd3eca529%22%2C%22%24device_id%22%3A%20%2216b55dd3ec9249-010a5d62d5b0df-3f72045a-100200-16b55dd3eca529%22%2C%22%24initial_referrer%22%3A%20%22https%3A%2F%2Fwww.sendo.vn%2Fnoi-dien-mini-sieu-toc-16cm-9780102.html%2F%22%2C%22%24initial_referring_domain%22%3A%20%22www.sendo.vn%22%7D; access_token=L9rjjfA%2BO8r%2FB2tKKPeUqCGIkJvQ2MLeAX6X9IU%2Bh7%2FQMraMXO0OTDI6q5KQuiQpMtRil3VLiLQ5YQ7hNIiaXx1KNF28cOuwoqcZMzHHuL8vjqCwejE4AqRy7wRvi3fSc8ZXOaEJ3ELzwhICbDWxtD8ECFa2%2FYu747hLzntseTc%3D; s_c_id_status=return; __stp={"visit":"returning","uuid":"4182cbe5-7b56-4f08-80e7-791e9b2c99a3","ck":"2028040157"}; SSID=3dpk3q2lh9aa3fvvd47gofcn94; __utma=147100981.2042790980.1560079024.1560771597.1560868721.7; __utmc=147100981; _gid=GA1.2.497193889.1560868722; closed_banner=1; __utmt=1; _dc_gtm_UA-32891946-6=1; _gat_UA-32891946-6=1; __utmb=147100981.10.7.1560869352932; _gid=GA1.3.497193889.1560868722; __sts={"sid":1560869354601,"tx":1560869354601,"url":"https%3A%2F%2Fcheckout.sendo.vn%2F%3Fproduct%3Df7d297e36834ca67203d25304afd4adf%26sendo_platform%3Ddesktop2%26shop%3D499867","pet":1560869354601,"set":1560869354601}; __stgeo="0"; __stbpnenable=1`;



/*** config winston **/
const logger = winston.createLogger({
	transports: [
		new winston.transports.File({ filename: 'saleLog.txt'})
	]
});
/*** config winston **/

const headers = {
	'Cookie': Cookie,
	'Content-Type': 'application/json'
};


function saleHunter(current_product_hash, currentShopId, plan) {
	const TOTAL_REQUEST = 60;
	let current_number_request = 0;
	let is_bought_success = false;
	let mainInterval = null;

	const relativePlan = new Date(plan - (0.5 * 60 * 1000));
	const job = nodeSchedule.scheduleJob(relativePlan, function () {
		const relativeTime = 0.25 * 1000;
		const myInterval = setInterval(function () {
			const now = new Date().getTime();
			if ((plan - now) < relativeTime) {
				clearInterval(myInterval);
				logger.info(`*******************************************`);
				logger.info(`Start hunter: ` + new Date().toUTCString());
				mainInterval = setInterval(function () {
					if (current_number_request < TOTAL_REQUEST && !is_bought_success) {
						getInfo(current_product_hash, currentShopId);
						current_number_request++;
						clearInterval(mainInterval);
					}
				}, 37);
			}
		}, 50);
	});

	function getInfo(product_hash, shopId) {
		const url = 'https://checkout.sendo.vn/api/checkout/info';
		const body = JSON.stringify({
			"shop_id": Number(shopId),
			"item_hash": String(product_hash),
			"sendo_platform": "desktop2",
			"current_voucher": {"enable_suggest_voucher": true},
			"enable_tracking": true,
			"ignore_invalid_product": -1,
			"version": 2.1
		});

		post(url, body, headers).
		then((res) => {
			if (typeof res.data.products_checkout.products[0].promotion !== 'undefined') {
				buy(res.data, product_hash, shopId);
			}
		});
	}


	function buy(res, product_hash, shopId) {
		let body = {
			"shop_id": Number(shopId),
			"item_hash": product_hash,
			"current_products": null,
			"current_address_id": null,
			"current_carrier": null,
			"current_payment_method": {
				"method": "cod_payment"
			},
			"current_voucher": {
				"voucher_code": "",
				"voucher_value": 0,
				"is_shop_voucher": false,
				"voucher_campaign_code": "",
				"sub_total": 0,
				"payment_method": "",
				"error": "",
				"is_enable_captcha": false,
				"captcha_response": "",
				"enable_suggest_voucher": true,
				"tracking_order_source": 0,
				"suggested_message": "",
				"redeemed_at": 0
			},
			"sendo_platform": "desktop2",
			"ignore_invalid_product": -1,
			"product_hashes": [product_hash],
			"version": 2.1
		};

		body.current_products = res.products_checkout.products;
		body.current_address_id = res.customer_data.current_address_id;
		body.current_carrier = res.shipping_info.current_carrier;

		body = JSON.stringify(body);

		const url = 'https://checkout.sendo.vn/api/checkout/save-order';
		post(url, body, headers).
		then((data) => {
			if (data.increment_id !== undefined && data.payment_type !== undefined) {
				is_bought_success = true;
				clearInterval(mainInterval);
				return logger.info(`Hunter Success: ` + new Date().toUTCString());
			}
			logger.info(`Hunter Failure: ` + new Date().toUTCString());
		});
	}


	function post(url, body, headers) {
		return new Promise((resolve, reject) => {
			const options = {
				method: 'POST',
				headers
			};
			const req = https.request(url, options, (response) => {
				let data = '';
				response.on('data', (chunk) => {
					data += chunk;
				});
				response.on('end', () => {
					if (response.statusCode === 200) {
						data = JSON.parse(data);
						return resolve(data);
					}
					return reject(null);
				});
			});
			req.on('error', (error) => {
				return reject(error);
			});
			req.write(body);
			req.end();
		});
	}
}


saleHunter('445d301d0d868a538213b6406cd38bb7', 276722, new Date(2019, 5, 20, 19).getTime());