"use strict";
/**
 * Project: sendo_sale_hunter
 * Author: Le Hai Diep(dieple)
 * Date-Time: 18/06/2019-21:51
 */
const https = require("https");
const nodeSchedule = require('node-schedule');
const winston = require('winston');

const Cookie = `tracking_id=b547f022526f4c9b8ccd5d30460be4b5; browserid=13c5ba3cd292e742f05bef43c813045c; _gcl_au=1.1.1070992975.1559353125; __utma=147100981.241459878.1559353126.1562335453.1562411395.8; __utmz=147100981.1559353126.1.1.utmcsr=(direct)|utmccn=(direct)|utmcmd=(none); _ga=GA1.2.241459878.1559353126; cto_lwid=95d1ca53-e661-4c42-98fd-f6d02d099ada; _fbp=fb.1.1559353126136.706245720; cto_idcpy=f455952b-d1b6-4b67-a71b-a7c365959d8f; login_type=fosp; _ga=GA1.3.241459878.1559353126; __stp={"visit":"returning","uuid":"78e0fa2f-cac9-4f8d-bdfe-380820081781","ck":"2028846286"}; s_c_id_status=return; WZRK_G=d1366a76a74a4d2491a031f90c195cfd; s_c_id_type=fosp; _gid=GA1.2.1111655810.1562335458; access_token=OHWvAipghrjCCbvdygrbN4Ra3Y9Ob6dA6K6DiO4xDvKLJBKsJMXLw8vbz4%2Bk9W1k2AIzqwy03qcbWaQ7pnDeSplwV6X5YI24jRWKpqdAKha5xzrYQtfZkPJHcAs%2BUqjstc%2FbF6JgJFG7crFtzXg3%2B0iPkGDkedWj2nRP4yBn%2F2o%3D; SSID=gr4nchtdkpujgqv6efoaeqk224; __utmb=147100981.9.8.1562411417530; __utmc=147100981; __utmt=1; WZRK_S_466-944-R55Z=%7B%22p%22%3A5%2C%22s%22%3A1562411395%2C%22t%22%3A1562411431%7D; closed_banner=1; _gat_UA-32891946-6=1; _gid=GA1.3.1111655810.1562335458; __sts={"sid":1562411419621,"tx":1562411419621,"url":"https%3A%2F%2Fcheckout.sendo.vn%2F%3Fproduct%3Dd0499cc4cda29ace4cb14a270ccab5c4%26sendo_platform%3Ddesktop2%26shop%3D414094","pet":1562411419621,"set":1562411419621}; __stdf=0; __stgeo="0"; __stbpnenable=1`;


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
	const TOTAL_REQUEST = 20;
	let current_number_request = 0;
	let is_bought_success = false;
	let mainInterval = null;
	let saveOrderData = null;

	const relativePlan = new Date(plan - 5000);
	const job = nodeSchedule.scheduleJob(relativePlan, function () {
		const relativeTime = 0.1 * 1000;
		const myInterval = setInterval(function () {
			const now = new Date().getTime();
			if ((plan - now) < relativeTime) {
				clearInterval(myInterval);
				logger.info(`*******************************************`);
				logger.info(`Start hunter: ` + new Date().toUTCString());
				mainInterval = setInterval(function () {
					if (current_number_request < TOTAL_REQUEST && !is_bought_success) {
						if (saveOrderData) {
							buy();
						} else {
							getInfo();
						}
						current_number_request++;
					} else {
						clearInterval(mainInterval);
					}
				}, 37);
			}
		}, 50);
	});

	function getInfo() {
		const url = 'https://checkout.sendo.vn/api/checkout/info';
		const body = JSON.stringify({
			"shop_id": Number(currentShopId),
			"item_hash": String(current_product_hash),
			"sendo_platform": "desktop2",
			"current_voucher": {"enable_suggest_voucher": true},
			"enable_tracking": true,
			"ignore_invalid_product": -1,
			"version": 2.1
		});

		post(url, body, headers).
		then((res) => {
			if (typeof res.data !== 'undefined' && typeof res.data.products_checkout.products[0].promotion !== 'undefined') {
				buy(res.data);
			}
		}).catch((error) => {
			// logger.error(`${url} failed with reason: ${error.message}`);
		});
	}


	function buy(res) {
		let body = null;
		if (!saveOrderData) {
			body = {
				"shop_id": Number(currentShopId),
				"item_hash": current_product_hash,
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
				"product_hashes": [current_product_hash],
				"version": 2.1
			};

			body.current_products = res.products_checkout.products;
			body.current_address_id = res.customer_data.current_address_id;
			body.current_carrier = res.shipping_info.current_carrier;
			body = JSON.stringify(body);
			saveOrderData = body;
		} else {
			body = saveOrderData;
		}

		const url = 'https://checkout.sendo.vn/api/checkout/save-order';
		post(url, body, headers).
		then((data) => {
			if (data.increment_id !== undefined && data.payment_type !== undefined) {
				is_bought_success = true;
				clearInterval(mainInterval);
				const now = new Date();
				return logger.info(`Hunter Success: ${now.getMinutes()} ${now.getMilliseconds()}`);
			}
			logger.info(`Hunter Failure: ` + new Date().toUTCString());
		}).catch((error) => {
			// logger.error(`${url} failed with reason: ${error.message}`);
		});
	}


	function post(url, body, headers) {
		return new Promise((resolve, reject) => {
			const options = {
				method: 'POST',
				headers,
				rejectUnauthorized: false
			};
			const req = https.request(url, options, (response) => {
				let data = [];
				response.on('data', (chunk) => {
					data.push(chunk);
				});
				response.on('end', () => {
					// logger.info(`${url}: ${response.statusCode}`);
					if (response.statusCode === 200) {
						data = Buffer.concat(data);
						data = JSON.parse(data.toString());
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

saleHunter('d0499cc4cda29ace4cb14a270ccab5c4',414094 , new Date(2019, 6, 6, 12).getTime());