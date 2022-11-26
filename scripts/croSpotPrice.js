const { ethers } = require("hardhat")

async function croSpotPrice() {
    const { deployer } = await getNamedAccounts()
    const inputAmt = "1000000000000000000"

    //get naive price **Must be compared to fair price for saftey**
    const sellPrice = await getSellPrice(deployer, inputAmt)
    console.log(
        `Croswap: 1 WETH gets ${ethers.utils.formatEther(sellPrice)} DAI.`
    )
    return sellPrice
}

async function getSellPrice(account, inputAmt) {
    const croPair = await ethers.getContractAt(
        "IUniswapV2Pair",
        "0x60A26d69263eF43e9a68964bA141263F19D71D51",
        account
    )
    const { reserve0, reserve1 } = await croPair.getReserves()
    const croRouter = await ethers.getContractAt(
        "IUniswapV2Router02",
        "0xCeB90E4C17d626BE0fACd78b79c9c87d7ca181b3",
        account
    )
    const sellPrice = (
        await croRouter.getAmountIn(inputAmt, reserve0, reserve1)
    ).toString()

    return sellPrice
}

module.exports = { croSpotPrice }
