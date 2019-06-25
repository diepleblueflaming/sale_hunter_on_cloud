"use strict";
/**
 * Project: sendo_sale_hunter
 * Author: Le Hai Diep(dieple)
 * Date-Time: 18/06/2019-21:51
 */
const https = require("https");
const nodeSchedule = require('node-schedule');
const winston = require('winston');

const Cookie = `_ga=GA1.3.2042790980.1560079024; tracking_id=ebd11a163ea64e1188bef9aa3bc207ab; browserid=c46e2274ef7a7216cb08b17489d920cf; __utmz=147100981.1561043320.1.1.utmcsr=(direct)|utmccn=(direct)|utmcmd=(none); _gcl_au=1.1.1892877907.1561043320; _ga=GA1.2.335305423.1561043320; cto_lwid=c5b3511f-0648-4104-8915-fb0b41312585; _fbp=fb.1.1561043320525.1132653891; login_type=fosp; s_c_id_type=fosp; SSID=c8ppmin9r8gbjrofkpuslig9q5; __utma=147100981.335305423.1561043320.1561255118.1561476626.13; __utmc=147100981; __utmt=1; _gid=GA1.2.1461826516.1561476627; _dc_gtm_UA-32891946-6=1; WZRK_G=1206267572da46b08942116ec71a1f7f; access_token=kG3ZQ9Flw0K3o5aV%2BQjTWQov89MTETFgIu08xg5TOSnenrGvdoO9kxlnRBLuqA9Eu7gWaguJ%2BzEXFfsZVipt3S0%2FS9maQ3MTsnSkuyTkflwUNVH3cMRlfr1s1uuJ53cHR%2FMcw5fb0li6QPkig57ZD9Sc6g1tJ2yt9w9vWTe6asQ%3D; s_c_id_status=return; _gat_UA-32891946-6=1; __utmb=147100981.12.7.1561476654648; _gid=GA1.3.1461826516.1561476627; __stp={"visit":"returning","uuid":"98267a5b-7164-45e9-a279-b5df3f0dfa40","ck":"2027412012"}; __sts={"sid":1561476656201,"tx":1561476656201,"url":"https%3A%2F%2Fcheckout.sendo.vn%2F%3Fproduct%3D6451cc91c7c7b5bb42235916e6e64de7%26sendo_platform%3Ddesktop2%26shop%3D346887","pet":1561476656201,"set":1561476656201}; __stdf=0; WZRK_S_466-944-R55Z=%7B%22p%22%3A7%2C%22s%22%3A1561476627%2C%22t%22%3A1561476656%7D; __stgeo="0"; __stbpnenable=1`;


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
				}, 33);
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
			logger.error(`${url} failed with reason: ${error.message}`);
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
			logger.error(`${url} failed with reason: ${error.message}`);
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

saleHunter('', , new Date(2019, 5, 23, 9, 14).getTime());