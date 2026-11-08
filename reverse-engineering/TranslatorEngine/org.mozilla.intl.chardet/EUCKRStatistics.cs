namespace org.mozilla.intl.chardet;

public class EUCKRStatistics : nsEUCStatistics
{
	private static float[] m_FirstByteFreq;

	private static float m_FirstByteStdDev;

	private static float m_FirstByteMean;

	private static float m_FirstByteWeight;

	private static float[] m_SecondByteFreq;

	private static float m_SecondByteStdDev;

	private static float m_SecondByteMean;

	private static float m_SecondByteWeight;

	public override float[] mFirstByteFreq()
	{
		return m_FirstByteFreq;
	}

	public override float mFirstByteStdDev()
	{
		return m_FirstByteStdDev;
	}

	public override float mFirstByteMean()
	{
		return m_FirstByteMean;
	}

	public override float mFirstByteWeight()
	{
		return m_FirstByteWeight;
	}

	public override float[] mSecondByteFreq()
	{
		return m_SecondByteFreq;
	}

	public override float mSecondByteStdDev()
	{
		return m_SecondByteStdDev;
	}

	public override float mSecondByteMean()
	{
		return m_SecondByteMean;
	}

	public override float mSecondByteWeight()
	{
		return m_SecondByteWeight;
	}

	public EUCKRStatistics()
	{
		m_FirstByteFreq = new float[94]
		{
			0f, 0f, 0f, 0f, 0f, 0f, 0f, 0.000412f, 0f, 0f,
			0f, 0f, 0f, 0f, 0f, 0.057502f, 0.033182f, 0.002267f, 0.016076f, 0.014633f,
			0.032976f, 0.004122f, 0.011336f, 0.058533f, 0.024526f, 0.025969f, 0.054411f, 0.01958f, 0.063273f, 0.113974f,
			0.029885f, 0.150041f, 0.059151f, 0.002679f, 0.009893f, 0.014839f, 0.026381f, 0.015045f, 0.069456f, 0.08986f,
			0f, 0f, 0f, 0f, 0f, 0f, 0f, 0f, 0f, 0f,
			0f, 0f, 0f, 0f, 0f, 0f, 0f, 0f, 0f, 0f,
			0f, 0f, 0f, 0f, 0f, 0f, 0f, 0f, 0f, 0f,
			0f, 0f, 0f, 0f, 0f, 0f, 0f, 0f, 0f, 0f,
			0f, 0f, 0f, 0f, 0f, 0f, 0f, 0f, 0f, 0f,
			0f, 0f, 0f, 0f
		};
		m_FirstByteStdDev = 0.025593f;
		m_FirstByteMean = 0.010638f;
		m_FirstByteWeight = 0.647437f;
		m_SecondByteFreq = new float[94]
		{
			0.016694f, 0f, 0.012778f, 0.030091f, 0.002679f, 0.006595f, 0.001855f, 0.000824f, 0.005977f, 0.00474f,
			0.003092f, 0.000824f, 0.01958f, 0.037304f, 0.008244f, 0.014633f, 0.001031f, 0f, 0.003298f, 0.002061f,
			0.006183f, 0.005977f, 0.000824f, 0.021847f, 0.014839f, 0.052968f, 0.017312f, 0.007626f, 0.000412f, 0.000824f,
			0.011129f, 0f, 0.000412f, 0.001649f, 0.005977f, 0.065746f, 0.020198f, 0.021434f, 0.014633f, 0.004122f,
			0.001649f, 0.000824f, 0.000824f, 0.051937f, 0.01958f, 0.023289f, 0.026381f, 0.040396f, 0.009068f, 0.001443f,
			0.00371f, 0.00742f, 0.001443f, 0.01319f, 0.002885f, 0.000412f, 0.003298f, 0.025969f, 0.000412f, 0.000412f,
			0.006183f, 0.003298f, 0.066983f, 0.002679f, 0.002267f, 0.011129f, 0.000412f, 0.010099f, 0.015251f, 0.007626f,
			0.043899f, 0.00371f, 0.002679f, 0.001443f, 0.010923f, 0.002885f, 0.009068f, 0.019992f, 0.000412f, 0.00845f,
			0.005153f, 0f, 0.010099f, 0f, 0.001649f, 0.01216f, 0.011542f, 0.006595f, 0.001855f, 0.010923f,
			0.000412f, 0.023702f, 0.00371f, 0.001855f
		};
		m_SecondByteStdDev = 0.013937f;
		m_SecondByteMean = 0.010638f;
		m_SecondByteWeight = 0.352563f;
	}
}
