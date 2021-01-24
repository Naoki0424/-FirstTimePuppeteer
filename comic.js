const puppeteer = require('puppeteer-core');
const fs = require('fs');
const { GoogleSpreadsheet } = require('google-spreadsheet');

(async () => {
    console.log('処理開始')

    //option
    var option = {
        headless : false,
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        args: [
            // ウインドウサイズをデフォルトより大きめに。
            '--window-size=1920,1080',
        ],
    }

    // 初期化
    const browser = await puppeteer.launch(option)

    // JSON読み込み
    const jsonObject = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

    try {
        // ページ作成
        const page = await browser.newPage()

        // 表示領域を設定
        await page.setViewport({
            width: 1920,
            height: 1080
        })

        // シーモアのトップページへアクセス
        await page.goto(jsonObject.COMIC_TOP)

        // ログイン画面に遷移
        await toNextPage(page, '//*[@id="home"]/header/div[1]/div[3]/a[1]')

        // IDとパスワードを入力
        await page.type('input[name=email]', jsonObject.COMIC_ID, { delay: 100 })
        await page.type('input[name=password]', jsonObject.COMIC_PATHWORD, { delay: 100 })
        
        // ログインする
        await toNextPage(page, '//*[@id="submitBtn"]')

        // 無料コミックに遷移する
        await toNextPage(page, '//*[@id="home"]/div[12]/a[5]')

        // 男性誌に遷移
        await toNextPage(page, '//*[@id="home"]/section[2]/div/div/section[2]/div[1]/ul[1]/a[4]')

        // 無料の漫画の一覧を取得する
        var comicList = await page.$$('#home > section.co_container.pc_with > div > div > section.cam_wrapper2 > ul > li')

        // 漫画の情報をCSV形式で保持
        var outputCsvList = []
        outputCsvList.push(getCsvHeadder())

        for (let i = 1; i <= 2; i++) {
        // for (let i = 1; i <= comicList.length - 20; i++) {
            // 無料で読める漫画のページに遷移する
            await toNextPage(page, '//*[@id="home"]/section[2]/div/div/section[3]/ul/li[' + i + ']/div[2]/div/p[1]/a')
            // 情報をCSV形式で詰める
            outputCsvList.push(await getCsvText(outputCsvList, page))
            // 情報を取得できたら１つ前の画面に戻る
            await page.goBack()
        }
        // CSV出力
        exportCSV(outputCsvList)

    }catch(error){
        console.log('エラー：main')
        console.log(error)
    }finally {
        await browser.close()
    }

    console.log('処理終了')
})()

// XPathを指定し、対象の要素をクリックすることで画面遷移を行う
async function toNextPage(page, targetXPath) {
    try {
        // 要素を取得
        const nextPage = await page.$x(targetXPath)
        // 一番目の要素をクリックする
        await nextPage[0].click()
        // 画面遷移が完了するまで待つ
        await page.waitForNavigation({ waitUntil: 'networkidle2' })
    }catch(error) {
        console.log('エラー：toNextPage')
        console.log(error)
    }
}

// 項目を取得しCSVの要素として設定する
async function getCsvText(outputCsvList, page) {
    // タイトル
    title = await getTextContentByXPath(page, ['//*[@id="GA_this_page_title_name"]'])
    // 評価
    star = await getTextContentByXPath(page, ['//*[@id="purchase_form"]/div[1]/div[1]/div[3]/div[2]/div/span[2]'])
    // 価格
    cost = await getTextContentByXPath(page, ['//*[@id="purchase_form"]/div[1]/div[1]/div[3]/div[1]/div[2]/div/div[3]/div[2]'])
    // 期限
    expirationDate = await getTextContentByXPath(page, ['//*[@id="purchase_form"]/div[1]/div[1]/div[2]/div[2]/div[1]/div[2]/a/div/span[2]'], '購入済み')
    // 配列を返す
    return [title, star, cost, expirationDate]
    
}

// ヘッダー
function getCsvHeadder() {
    return ['タイトル', '評価', '値段', '期限']
}

// セレクタを用いて画面の表示内容を取得する
async function getTextContentBySelector(page, selectorList) {
    for(let i = 0; i < selectorList.length; i++) {
        const ele = await page.$(selectorList[i])
        if(ele == null) {
            continue
        }
        return await page.evaluate(elm => elm.textContent, ele)
    }
    return '取得失敗'
}

// XPathを用いて画面の表示内容を取得する
async function getTextContentByXPath(page, xPathList, noneText) {
    // 値が取得できなかった際のテキスト
    var noneText = noneText || '取得失敗（要確認）'
    for(let i = 0; i < xPathList.length; i++) {
        const ele = await page.$x(xPathList[i])
        if(ele == null || ele.length == 0) {
            continue
        }
        return await page.evaluate(elm => elm.textContent, ele[0])
    }
    return noneText
}

// 配列をcsvで保存するfunction
function exportCSV(content){
    var formatCSV = ''
    for (var i = 0; i < content.length; i++) {
        var value = content[i]
        for (var j = 0; j < value.length; j++) { 
            var innerValue = value[j]===null ? '' : value[j].toString()
            var result = innerValue.replace(/"/g, '""')
            if (result.search(/("|,|\n)/g) >= 0) {
                result = '"' + result + '"'
            }
            if (j > 0) {
                formatCSV += ','
            }
            formatCSV += result
        }
        formatCSV += '\n'
    }
    fs.writeFile('formList.csv', formatCSV, 'utf8', function (err) {
      if (err) {
        console.log('保存できませんでした')
      } else {
        console.log('保存できました')
      }
    })
}

// スプレッドシートにアクセスする
const getSpreadsheetTitleByKey = async (spreasheetKey) => {
    // 一般ユーザーに公開していないスプレッドシートへアクセスしたい場合, 作成したサービスアカウントに対し
    // 閲覧権限を与えておく.
    const doc = new GoogleSpreadsheet(spreasheetKey)
    
    // サービスアカウントによる認証
    await doc.useServiceAccountAuth({
        client_email: CREDIT.client_email,
        private_key: CREDIT.private_key,
    })

    // スプレッドシートの情報を読み込みを行い, タイトルを取得
    await doc.loadInfo()
    console.log(doc.title)
}