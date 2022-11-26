const { uniSpotPrice } = require("../scripts/uniSpotPrice")
const { sushiSpotPrice } = require("../scripts/sushiSpotPrice")
const { shibaSpotPrice } = require("../scripts/shibaSpotPrice")
const { sakeSpotPrice } = require("../scripts/sakeSpotPrice")
const { croSpotPrice } = require("../scripts/croSpotPrice")
const { ethers, hre } = require("hardhat")
const { getWETH, AMOUNT } = require("./getWETH")

//user inputed varibles (arbitrage settings)
const WETH_AMOUNT = ethers.utils.formatEther(AMOUNT)
const TOTAL_LOOPS = 30
const loopingEnabled = false

//do not touch
let loopIteration = 0
let cycleProfit = 0
const wethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
const daiAddress = "0x6b175474e89094c44da98b954eedeac495271d0f"

async function loopTracker() {
    if (loopIteration < TOTAL_LOOPS) {
        loopIteration++
        console.log(`Iteration: ${loopIteration}.`)
        setTimeout(() => {
            findArbitrage()
        }, 10000)
    } else {
        console.log("Scanning Complete.")
        console.log(`Arbitrage made ${cycleProfit} DAI.`)
        process.exit(0)
    }
}

async function getFunds() {
    const { deployer } = await getNamedAccounts()

    //get WETH
    await getWETH()

    // Get dai for arbitrage
    await getDai(AMOUNT, WETH_AMOUNT, wethAddress, daiAddress, deployer)
}

async function findArbitrage() {
    const { deployer } = await getNamedAccounts()
    const provider = ethers.getDefaultProvider()

    //get external, "fair" price
    const oraclePriceUSD = await getOraclePrice()
    let prices = []

    //get DEX naive price data
    prices.push(
        {
            name: "uni",
            price: (await uniSpotPrice()).toString(),
            routerAddress: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
            pairAddress: "0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11",
        },
        {
            name: "sushi",
            price: (await sushiSpotPrice()).toString(),
            routerAddress: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
            pairAddress: "0xC3D03e4F041Fd4cD388c549Ee2A29a9E5075882f",
        },
        {
            name: "shiba",
            price: (await shibaSpotPrice()).toString(),
            routerAddress: "0x03f7724180AA6b939894B5Ca4314783B0b36b329",
            pairAddress: "0x8faf958E36c6970497386118030e6297fFf8d275",
        },
        {
            name: "sake",
            price: (await sakeSpotPrice()).toString(),
            routerAddress: "0x9C578b573EdE001b95d51a55A3FAfb45f5608b1f",
            pairAddress: "0x2ad95483ac838E2884563aD278e933fba96Bc242",
        },
        {
            name: "cro",
            price: (await croSpotPrice()).toString(),
            routerAddress: "0xCeB90E4C17d626BE0fACd78b79c9c87d7ca181b3",
            pairAddress: "0x60A26d69263eF43e9a68964bA141263F19D71D51",
        }
    )

    //remove unreasonable prices (dead pools && manipulated prices) by comparing DEX prices to "fair" price
    const maxResonable = oraclePriceUSD + oraclePriceUSD * 0.05
    const minResonable = oraclePriceUSD - oraclePriceUSD * 0.05
    for (let i = 0; i < prices.length; i++) {
        if (
            ethers.utils.formatEther(prices[i].price) > maxResonable ||
            ethers.utils.formatEther(prices[i].price) < minResonable
        ) {
            prices.splice(i, 1)
        }
    }

    //find best path: DAI => WETH (lowest) then WETH => DAI (highest)
    prices.sort(function (a, b) {
        return a.price - b.price
    })
    let buyPrice = prices[0]
    console.log(buyPrice)

    prices.sort(function (a, b) {
        return b.price - a.price
    })
    let sellPrice = prices[0]
    console.log(sellPrice)

    //find max amount possible to arbitrage with

    //determine if profitable (profit - gas && fees)
    let revenueUSD =
        (
            ethers.utils.formatEther(sellPrice.price) -
            ethers.utils.formatEther(buyPrice.price)
        ).toString() * WETH_AMOUNT
    const ETHfee = 2 * WETH_AMOUNT * 0.003
    const TOTAL_DEX_FEE = ETHfee * oraclePriceUSD
    const GAS_PRICE = ethers.utils.formatEther(await provider.getGasPrice())
    let gasFees = ("161000" * GAS_PRICE).toString() * "2"
    gasFees = gasFees * oraclePriceUSD
    const profitUSD = revenueUSD - (TOTAL_DEX_FEE + gasFees)

    console.log(
        `Spread: ${
            ethers.utils.formatEther(sellPrice.price) -
            ethers.utils.formatEther(buyPrice.price)
        } DAI.`
    )
    console.log(`Best trade would make about ${profitUSD.toString()} DAI.`)

    if (profitUSD > "0") {
        let gross = await arbitrage(
            wethAddress,
            daiAddress,
            buyPrice,
            sellPrice,
            deployer
        )
        cycleProfit += gross
        // await getFunds()
        if (loopingEnabled == true) {
            loopTracker()
        }
    } else {
        if (loopingEnabled == true) {
            loopTracker()
        } else {
            console.log("Not preforming trade.")
            console.log(`Arbitrage made ${cycleProfit} DAI.`)
            process.exit(0)
        }
    }
}

async function arbitrage(token0, token1, exchangeBuy, exchangeSell, account) {
    //get dai balance
    const daiContract = await ethers.getContractAt("IERC20", token1, account)
    const daiAmount = await daiContract.balanceOf(account)
    console.log(
        `You have ${(
            daiAmount / exchangeBuy.price
        ).toString()} ETH worth of DAI.`
    )

    //approve tokens for swap
    //approve pair
    await approveErc20(token0, exchangeBuy.pairAddress, daiAmount, account)
    await approveErc20(token1, exchangeBuy.pairAddress, daiAmount, account)

    //approve router
    await approveErc20(token0, exchangeBuy.routerAddress, daiAmount, account)
    await approveErc20(token1, exchangeBuy.routerAddress, daiAmount, account)

    //swap dai for weth at best price
    const buyRouter = await ethers.getContractAt(
        "IUniswapV2Router02",
        exchangeBuy.routerAddress,
        account
    )

    const pair1 = []
    pair1.push(token1, token0)
    const buyTx =
        await buyRouter.swapExactTokensForTokensSupportingFeeOnTransferTokens(
            daiAmount,
            ethers.utils.parseEther(
                (daiAmount / exchangeBuy.price / 1.05).toString()
            ),
            pair1,
            account,
            Date.now() + 300000
        )
    await buyTx.wait(1)
    console.log("Swapped DAI for WETH!")

    //get WETH balance
    const wethContract = await ethers.getContractAt("IWeth", token0, account)
    const wethBalance = await wethContract.balanceOf(account)
    console.log(`You have ${ethers.utils.formatEther(wethBalance)} WETH.`)

    //approve tokens for swap
    //approve pair
    await approveErc20(token0, exchangeSell.pairAddress, wethBalance, account)
    await approveErc20(token1, exchangeSell.pairAddress, wethBalance, account)

    //approve router
    await approveErc20(token0, exchangeSell.routerAddress, wethBalance, account)
    await approveErc20(token1, exchangeSell.routerAddress, wethBalance, account)

    //swap weth back to dai at best price
    const sellRouter = await ethers.getContractAt(
        "IUniswapV2Router02",
        exchangeSell.routerAddress,
        account
    )

    const pair2 = []
    pair2.push(token0, token1)
    const sellTx =
        await sellRouter.swapExactTokensForTokensSupportingFeeOnTransferTokens(
            wethBalance,
            ethers.utils.parseEther(
                (ethers.utils.formatEther(wethBalance) / 1.05).toString()
            ),
            pair2,
            account,
            Date.now() + 300000
        )
    await sellTx.wait(1)
    console.log("Swapped WETH for DAI!")

    //get final balance and determine if arbitrage made money
    const finalDaiBal = await daiContract.balanceOf(account)
    let gross =
        ethers.utils.formatEther(finalDaiBal) -
        ethers.utils.formatEther(daiAmount)
    if (gross > "0") {
        console.log(`Arbitrage made ${gross} DAI!`)
        return gross
    } else {
        console.log(`Lost ${gross} DAI from arbitrage.`)
        return gross
    }
}

async function getDai(amount, daiAmount, token0, token1, account) {
    //uniV2 swaps must approve pair and router for transaction to go through
    //approve pair
    await approveErc20(
        token0,
        "0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11",
        amount,
        account
    )
    await approveErc20(
        token1,
        "0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11",
        amount,
        account
    )

    //approve router
    await approveErc20(
        token0,
        "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
        amount,
        account
    )
    await approveErc20(
        token1,
        "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
        amount,
        account
    )

    //connect to router
    const uniRouter02 = await ethers.getContractAt(
        "IUniswapV2Router02",
        "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
        account
    )
    const pair = []

    //path must be first token (WETH) to second token (DAI)
    pair.push(token0, token1)

    //amount input and recived must be in token0 (ETH; not DAI) **Swap takes out fee which will cause transaction to fail if input == output**
    const swapTx =
        await uniRouter02.swapExactTokensForTokensSupportingFeeOnTransferTokens(
            amount,
            ethers.utils.parseEther((daiAmount / 1.004).toString()),
            pair,
            account,
            Date.now() + 300000
        )
    await swapTx.wait(1)
    console.log(`Swapped ${ethers.utils.formatEther(amount)} WETH for DAI!`)
}

async function approveErc20(
    erc20Address,
    spenderAddress,
    amountToSpend,
    account
) {
    const erc20Token = await ethers.getContractAt(
        "IERC20",
        erc20Address,
        account
    )
    const tx = await erc20Token.approve(spenderAddress, amountToSpend)
    await tx.wait(1)
    //console.log("Approved!")
}

async function getOraclePrice() {
    const EthPrice = await ethers.getContractAt(
        "AggregatorV3Interface",
        "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419"
    )
    const price = (await EthPrice.latestRoundData())[1]
    console.log(`The ETH price is ${price.toString() / 100000000} USD`)
    return price / 100000000
}

async function main() {
    console.log("Starting V1.0.0 WETH/DAI Arbitrage")
    await getFunds()
    findArbitrage()
}
main()
