namespace org.mozilla.intl.chardet;

public class GB2312Statistics : nsEUCStatistics
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

	public GB2312Statistics()
	{
		m_FirstByteFreq = new float[94]
		{
			0.011628f, 0f, 0f, 0f, 0f, 0f, 0f, 0f, 0f, 0f,
			0f, 0f, 0f, 0f, 0f, 0.011628f, 0.012403f, 0.009302f, 0.003876f, 0.017829f,
			0.037209f, 0.008527f, 0.010078f, 0.01938f, 0.054264f, 0.010078f, 0.041085f, 0.02093f, 0.018605f, 0.010078f,
			0.013178f, 0.016279f, 0.006202f, 0.009302f, 0.017054f, 0.011628f, 0.008527f, 0.004651f, 0.006202f, 0.017829f,
			0.024806f, 0.020155f, 0.013953f, 0.032558f, 0.035659f, 0.068217f, 0.010853f, 0.036434f, 0.117054f, 0.027907f,
			0.100775f, 0.010078f, 0.017829f, 0.062016f, 0.012403f, 0f, 0f, 0f, 0f, 0f,
			0f, 0f, 0f, 0f, 0f, 0f, 0f, 0f, 0f, 0f,
			0f, 0f, 0f, 0.00155f, 0f, 0f, 0f, 0f, 0f, 0f,
			0f, 0f, 0f, 0f, 0f, 0f, 0f, 0f, 0f, 0f,
			0f, 0f, 0f, 0f
		};
		m_FirstByteStdDev = 0.020081f;
		m_FirstByteMean = 0.010638f;
		m_FirstByteWeight = 0.586533f;
		m_SecondByteFreq = new float[94]
		{
			0.006202f, 0.031008f, 0.005426f, 0.003101f, 0.00155f, 0.003101f, 0.082171f, 0.014729f, 0.006977f, 0.00155f,
			0.013953f, 0f, 0.013953f, 0.010078f, 0.008527f, 0.006977f, 0.004651f, 0.003101f, 0.003101f, 0.003101f,
			0.008527f, 0.003101f, 0.005426f, 0.005426f, 0.005426f, 0.003101f, 0.00155f, 0.006202f, 0.014729f, 0.010853f,
			0f, 0.011628f, 0f, 0.031783f, 0.013953f, 0.030233f, 0.039535f, 0.008527f, 0.015504f, 0f,
			0.003101f, 0.008527f, 0.016279f, 0.005426f, 0.00155f, 0.013953f, 0.013953f, 0.044961f, 0.003101f, 0.004651f,
			0.006977f, 0.00155f, 0.005426f, 0.012403f, 0.00155f, 0.015504f, 0f, 0.006202f, 0.00155f, 0f,
			0.007752f, 0.006977f, 0.00155f, 0.009302f, 0.011628f, 0.004651f, 0.010853f, 0.012403f, 0.017829f, 0.005426f,
			0.024806f, 0f, 0.006202f, 0f, 0.082171f, 0.015504f, 0.004651f, 0f, 0.006977f, 0.004651f,
			0f, 0.008527f, 0.012403f, 0.004651f, 0.003876f, 0.003101f, 0.022481f, 0.024031f, 0.00155f, 0.047287f,
			0.009302f, 0.00155f, 0.005426f, 0.017054f
		};
		m_SecondByteStdDev = 0.014156f;
		m_SecondByteMean = 0.010638f;
		m_SecondByteWeight = 0.413467f;
	}
}
