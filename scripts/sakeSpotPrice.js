const { ethers } = require("hardhat")

async function sakeSpotPrice() {
    const { deployer } = await getNamedAccounts()
    // const wethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
    // const daiAddress = "0x6b175474e89094c44da98b954eedeac495271d0f"
    const inputAmt = "1000000000000000000"

    //get address of pair
    //const pairAddress = await getPairAddress(deployer, wethAddress, daiAddress)

    //get naive price **Must be compared to fair price for saftey**
    const sellPrice = await getSellPrice(deployer, inputAmt)
    console.log(
        `Sakeswap: 1 WETH gets ${ethers.utils.formatEther(sellPrice)} DAI.`
    )
    return sellPrice
}

async function getSellPrice(account, inputAmt) {
    const sakePair = await ethers.getContractAt(
        "IUniswapV2Pair",
        "0x2ad95483ac838E2884563aD278e933fba96Bc242",
        account
    )
    const { reserve0, reserve1 } = await sakePair.getReserves()
    const sakeRouter = await ethers.getContractAt(
        "IUniswapV2Router02",
        "0x9C578b573EdE001b95d51a55A3FAfb45f5608b1f",
        account
    )
    const sellPrice = (
        await sakeRouter.getAmountIn(inputAmt, reserve0, reserve1)
    ).toString()

    return sellPrice
}

// async function getPairAddress(account, token0, token1) {
//     const sakeFactory = await ethers.getContractAt(
//         "IUniswapV2Factory",
//         "0x75e48C954594d64ef9613AeEF97Ad85370F13807",
//         account
//     )
//     const pairAddress = await sakeFactory.getPair(token0, token1)
//     //console.log(pairAddress)
//     return pairAddress
// }

module.exports = { sakeSpotPrice }
