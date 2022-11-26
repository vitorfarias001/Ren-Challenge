const { ethers } = require("hardhat")

async function shibaSpotPrice() {
    const { deployer } = await getNamedAccounts()
    // const wethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
    // const daiAddress = "0x6b175474e89094c44da98b954eedeac495271d0f"
    const inputAmt = "1000000000000000000"

    //get pair addresss
    // const pairAddress = await getPairAddress(deployer, wethAddress, daiAddress)

    //get dai price per WETH
    const sellPrice = await getSellPrice(deployer, inputAmt)
    console.log(
        `Shibaswap: 1 WETH gets ${ethers.utils.formatEther(sellPrice)} DAI.`
    )
    return sellPrice
}

async function getSellPrice(account, inputAmt) {
    const shibaPair = await ethers.getContractAt(
        "IUniswapV2Pair",
        "0x8faf958E36c6970497386118030e6297fFf8d275",
        account
    )
    const { reserve0, reserve1 } = await shibaPair.getReserves()
    const shibaRouter = await ethers.getContractAt(
        "IUniswapV2Router02",
        "0x03f7724180AA6b939894B5Ca4314783B0b36b329",
        account
    )
    const sellPrice = (
        await shibaRouter.getAmountIn(inputAmt, reserve0, reserve1)
    ).toString()

    return sellPrice
}

// async function getPairAddress(account, token0, token1) {
//     const shibaFactory = await ethers.getContractAt(
//         "IUniswapV2Factory",
//         "0x115934131916C8b277DD010Ee02de363c09d037c",
//         account
//     )
//     const pairAddress = await shibaFactory.getPair(token0, token1)
//     //console.log(pairAddress)
//     return pairAddress
// }

module.exports = { shibaSpotPrice }
