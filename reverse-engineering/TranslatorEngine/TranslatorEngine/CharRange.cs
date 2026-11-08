namespace TranslatorEngine;

public class CharRange
{
	private int startIndex;

	private int length;

	public int StartIndex
	{
		get
		{
			return startIndex;
		}
		set
		{
			startIndex = value;
		}
	}

	public int Length
	{
		get
		{
			return length;
		}
		set
		{
			length = value;
		}
	}

	public CharRange(int startIndex, int length)
	{
		this.startIndex = startIndex;
		this.length = length;
	}

	public bool IsInRange(int index)
	{
		if (startIndex <= index)
		{
			return index <= startIndex + length - 1;
		}
		return false;
	}

	public int GetEndIndex()
	{
		return startIndex + length - 1;
	}
}
